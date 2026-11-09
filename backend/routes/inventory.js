const express = require('express');
const InventoryItem = require('../models/InventoryItem');
const { moveStock } = require('../services/stock');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();
// IMPORTANT: copy the exact role strings from your requisitionRoutes.js (same spelling and capital letters)
const STAFF_ROLES = ['Moderator', 'Administrator'];
const staffOnly = restrictTo(...STAFF_ROLES);

const roleOf = (u) => String(u?.role || '').toLowerCase();
const isStaff = (u) => STAFF_ROLES.map((r) => r.toLowerCase()).includes(roleOf(u));
// The server decides who did it, never the browser. Adjust to your user fields.
const actorOf = (req) => {
  const u = req.user || {};
  return (
    [u.firstName, u.lastName].filter((n) => n && n !== '-').join(' ') || u.email || 'Unknown user'
  );
};

const whole = (v, min) => Math.max(min, Math.floor(Number(v) || 0));

function clean(b = {}) {
  const name = String(b.name || '').trim();
  const category = String(b.category || '').trim();
  if (!name) return { error: 'Item name is required.' };
  if (!category) return { error: 'Category is required.' };

  const value = {
    name,
    category,
    unit: String(b.unit || '').trim() || 'pcs',
    location: String(b.location || '').trim(),
    quantity: whole(b.quantity, 0),
    reorderLevel: whole(b.reorderLevel, 0),
    maxNormal: whole(b.maxNormal, 1),
  };

  // Only touch the supplier when the form actually sent it. Other pages
  // (for example the dashboards' edit form) don't have this field, and they
  // must not wipe a supplier that was already saved.
  if (b.supplier !== undefined) value.supplier = String(b.supplier || '').trim().slice(0, 120);

  return { value };
}

router.use(protect);

// Everyone logged in can read (the request form needs it). Regular users only get the fields
// they need, and never see archived items.
router.get('/', async (req, res, next) => {
  try {
    const staff = isStaff(req.user);
    const q = InventoryItem.find(staff ? {} : { archived: { $ne: true } }).sort({ createdAt: -1 });
    if (!staff) q.select('code name category unit quantity maxNormal');
    res.json(await q);
  } catch (e) {
    next(e);
  }
});

router.post('/', staffOnly, async (req, res, next) => {
  try {
    const { value, error } = clean(req.body);
    if (error) return res.status(400).json({ message: error });

    const by = actorOf(req);
    const item = await InventoryItem.create({
      ...value,
      code: await InventoryItem.nextCode(),
      addedBy: by,
      updatedBy: by,
      movements: [
        {
          type: 'Created',
          qty: value.quantity,
          before: 0,
          after: value.quantity,
          by,
          remark: 'Initial stock',
        },
      ],
    });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

router.put('/:code', staffOnly, async (req, res, next) => {
  try {
    const { value, error } = clean(req.body);
    if (error) return res.status(400).json({ message: error });

    const current = await InventoryItem.findOne({ code: req.params.code });
    if (!current) return res.status(404).json({ message: 'Item not found.' });
    if (current.archived) {
      return res.status(400).json({ message: 'This item is archived. Restore it before editing.' });
    }

    const by = actorOf(req);
    const changedQty = value.quantity !== current.quantity;

    // The quantity in the filter makes sure nobody changed the stock while this form was open
    const updated = await InventoryItem.findOneAndUpdate(
      { _id: current._id, quantity: current.quantity },
      {
        $set: { ...value, updatedBy: by },
        $push: {
          movements: {
            type: 'Edited',
            qty: Math.abs(value.quantity - current.quantity),
            before: current.quantity,
            after: value.quantity,
            by,
            remark: changedQty ? 'Quantity corrected during edit' : 'Item details edited',
          },
        },
      },
      { new: true }
    );
    if (!updated) {
      return res
        .status(409)
        .json({ message: 'Stock changed while you were editing. Close this and try again.' });
    }
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.post('/:code/adjust', staffOnly, async (req, res, next) => {
  try {
    const { mode, amount, reference, remark } = req.body || {};
    const qty = whole(Math.abs(Number(amount)), 0);
    if (!['add', 'remove'].includes(mode) || qty < 1) {
      return res.status(400).json({ message: 'Enter a valid quantity.' });
    }

    const target = await InventoryItem.findOne({ code: req.params.code }).select('archived');
    if (!target) return res.status(404).json({ message: 'Item not found.' });
    if (target.archived) {
      return res
        .status(400)
        .json({ message: 'This item is archived. Restore it before adjusting stock.' });
    }

    const result = await moveStock({ code: req.params.code }, mode === 'add' ? qty : -qty, {
      by: actorOf(req),
      reference: String(reference || '').trim(),
      remark: String(remark || '').trim(),
    });

    if (!result) {
      return res.status(400).json({ message: 'Not enough stock on hand.' });
    }
    res.json(result.item);
  } catch (e) {
    next(e);
  }
});

// Archive: the item stays in the database with its full history, it is only hidden.
// Moderators and administrators can both archive.
router.patch('/:code/archive', staffOnly, async (req, res, next) => {
  try {
    const current = await InventoryItem.findOne({ code: req.params.code });
    if (!current) return res.status(404).json({ message: 'Item not found.' });
    if (current.archived) return res.status(400).json({ message: 'Item is already archived.' });

    const by = actorOf(req);
    const updated = await InventoryItem.findOneAndUpdate(
      { _id: current._id, archived: { $ne: true } },
      {
        $set: { archived: true, archivedAt: new Date(), archivedBy: by, updatedBy: by },
        $push: {
          movements: {
            type: 'Archived',
            qty: 0,
            before: current.quantity,
            after: current.quantity,
            by,
            remark: 'Item archived',
          },
        },
      },
      { new: true }
    );
    if (!updated) return res.status(409).json({ message: 'Item was already archived.' });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// Restore an archived item back to the active inventory
router.patch('/:code/restore', staffOnly, async (req, res, next) => {
  try {
    const current = await InventoryItem.findOne({ code: req.params.code });
    if (!current) return res.status(404).json({ message: 'Item not found.' });
    if (!current.archived) return res.status(400).json({ message: 'Item is not archived.' });

    const by = actorOf(req);
    const updated = await InventoryItem.findOneAndUpdate(
      { _id: current._id, archived: true },
      {
        $set: { archived: false, updatedBy: by },
        $unset: { archivedAt: '', archivedBy: '' },
        $push: {
          movements: {
            type: 'Restored',
            qty: 0,
            before: current.quantity,
            after: current.quantity,
            by,
            remark: 'Item restored from archive',
          },
        },
      },
      { new: true }
    );
    if (!updated) return res.status(409).json({ message: 'Item was already restored.' });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

module.exports = router;