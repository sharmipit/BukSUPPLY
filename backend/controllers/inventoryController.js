const InventoryItem = require('../models/InventoryItem');
const Requisition = require('../models/Requisition');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { moveStock } = require('../services/stock');
const { logActivity } = require('../services/activityLog');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');

// IMPORTANT: copy the exact role strings from your requisitionRoutes.js (same spelling and capital letters)
// Exported so routes/inventory.js builds restrictTo(...) from the same list.
const STAFF_ROLES = ['Moderator', 'Administrator'];

const roleOf = (u) => String(u?.role || '').toLowerCase();
const isStaff = (u) => STAFF_ROLES.map((r) => r.toLowerCase()).includes(roleOf(u));
// The server decides who did it, never the browser. Adjust to your user fields.
const actorOf = (req) => {
  const u = req.user || {};
  return (
    [u.firstName, u.lastName].filter((n) => n && n !== '-').join(' ') || u.email || 'Unknown user'
  );
};

// ---------------------------------------------------------------------------
// Field rules. Keep these in sync with the top of src/pages/Inventory.jsx.
// The page blocks bad input while typing, but the server is the one that decides.
// ---------------------------------------------------------------------------
const LIMITS = {
  name: 80,
  supplier: 120,
  category: 40,
  unit: 15,
  reference: 40,
  remark: 200,
  maxQty: 100000, // largest quantity / reorder level / limit allowed
};

// A value is valid when removing every disallowed character leaves it unchanged.
// Units are letters, numbers, spaces and hyphens only (for example "pcs", "box of 10").
const STRIP = {
  name: /[^\p{L}\p{N} .,'’"()\-/&#+%:]/gu,
  category: /[^\p{L}\p{N} .,'’()\-/&]/gu,
  unit: /[^\p{L}\p{N} -]/gu,
  reference: /[^A-Za-z0-9 ._\-/#]/g,
  remark: /[<>{}`\\\u0000-\u001F\u007F]/g,
};
const NO_STRIP = /(?!)/g; // never matches: used to skip the character check for a kept legacy unit
const isClean = (value, strip) => value.replace(strip, '') === value;

// Trim and collapse repeated spaces / line breaks into single spaces
const squash = (v) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim();

// Returns an error message, or '' when the text is fine
function textError(value, { label, max, strip, required = false, min = 1, needsLetter = false }) {
  if (!value) return required ? `${label} is required.` : '';
  if (value.length < min) return `${label} must be at least ${min} characters.`;
  if (value.length > max) return `${label} must be ${max} characters or fewer.`;
  if (!isClean(value, strip)) return `${label} contains characters that are not allowed.`;
  if (needsLetter && !/[\p{L}\p{N}]/u.test(value)) {
    return `${label} must contain at least one letter or number.`;
  }
  return '';
}

// Whole numbers only: no negatives, decimals, exponents, or values above the limit.
// Nothing is silently corrected. A bad value is rejected with a message.
function wholeNumber(raw, { label, min, max }) {
  const s = String(raw ?? '').trim();
  if (s === '') return { error: `${label} is required.` };
  if (!/^\d+$/.test(s)) {
    return { error: `${label} must be a whole number (no negatives or decimals).` };
  }
  const n = Number(s);
  if (n < min) return { error: `${label} must be at least ${min}.` };
  if (n > max) return { error: `${label} cannot be more than ${max.toLocaleString('en-PH')}.` };
  return { value: n };
}

// keepUnit = the unit the item already has. Older items may have a unit such as "pcs." that the
// new rule would not allow, and editing the price or quantity must not fail because of that.
// Only a CHANGED unit has to follow the new rule.
function clean(b = {}, { keepUnit = '' } = {}) {
  const name = squash(b.name);
  const category = squash(b.category);
  const unit = squash(b.unit);
  const unitUnchanged = Boolean(keepUnit) && unit === keepUnit;

  let error =
    textError(name, {
      label: 'Item name',
      max: LIMITS.name,
      strip: STRIP.name,
      required: true,
      min: 2,
      needsLetter: true,
    }) ||
    textError(category, {
      label: 'Category',
      max: LIMITS.category,
      strip: STRIP.category,
      required: true,
      min: 2,
      needsLetter: true,
    }) ||
    textError(unit, {
      label: 'Unit',
      max: LIMITS.unit,
      strip: unitUnchanged ? NO_STRIP : STRIP.unit,
      required: true,
      needsLetter: !unitUnchanged,
    });
  if (error) return { error };

  const quantity = wholeNumber(b.quantity, {
    label: 'Quantity on hand',
    min: 0,
    max: LIMITS.maxQty,
  });
  if (quantity.error) return { error: quantity.error };
  const reorderLevel = wholeNumber(b.reorderLevel, {
    label: 'Reorder level',
    min: 0,
    max: LIMITS.maxQty,
  });
  if (reorderLevel.error) return { error: reorderLevel.error };
  const maxNormal = wholeNumber(b.maxNormal, {
    label: 'Normal limit per request',
    min: 1,
    max: LIMITS.maxQty,
  });
  if (maxNormal.error) return { error: maxNormal.error };

  const value = {
    name,
    category,
    unit,
    location: squash(b.location),
    quantity: quantity.value,
    reorderLevel: reorderLevel.value,
    maxNormal: maxNormal.value,
  };

  // Only touch the supplier when the form actually sent it. Other pages
  // (for example the dashboards' edit form) don't have this field, and they
  // must not wipe a supplier that was already saved.
  if (b.supplier !== undefined) {
    const supplier = squash(b.supplier);
    error = textError(supplier, {
      label: 'Supplier name',
      max: LIMITS.supplier,
      strip: STRIP.name,
    });
    if (error) return { error };
    value.supplier = supplier;
  }

  return { value };
}

// ---------------------------------------------------------------------------
// Open requests. An item cannot be archived while a request that is still being
// handled (Pending, Processing or Approved) asks for it.
// ---------------------------------------------------------------------------
const OPEN_STATUSES = ['Pending', 'Processing', 'Approved'];
const keyOf = (s) =>
  String(s || '')
    .trim()
    .toLowerCase();

async function openRequestsFor(item) {
  // The few open slips are loaded and checked here. Old slips have no saved item link,
  // so those are matched by item name (the same fallback services/stock.js uses).
  const slips = await Requisition.find({ status: { $in: OPEN_STATUSES } }).lean();

  return slips
    .filter((s) =>
      [...(s.itemsList || []), ...(s.purchaseItems || [])].some((l) =>
        l.inventoryItemId
          ? String(l.inventoryItemId) === String(item._id)
          : keyOf(l.name) === keyOf(item.name)
      )
    )
    .map((s) => ({ slip: s.slipNumber, status: s.status, title: s.title || '' }));
}

function blockedMessage(item, open) {
  const n = open.length;
  const shown = open
    .slice(0, 3)
    .map((r) => r.slip)
    .join(', ');
  const more = n > 3 ? ` and ${n - 3} more` : '';
  return (
    `${item.name} can't be archived yet. It is on ${n} open request${n > 1 ? 's' : ''} ` +
    `(${shown}${more}). Archive it after ${n > 1 ? 'they are' : 'it is'} completed, denied, or cancelled.`
  );
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// Everyone logged in can read (the request form needs it). Regular users only get the fields
// they need, and never see archived items.
exports.listItems = asyncHandler(async (req, res) => {
  const staff = isStaff(req.user);
  const q = InventoryItem.find(staff ? {} : { archived: { $ne: true } }).sort({ createdAt: -1 });
  if (!staff) q.select('code name category unit quantity maxNormal');
  res.json(await q);
});

exports.createItem = asyncHandler(async (req, res) => {
  const { value, error } = clean(req.body);
  if (error) throw new AppError(error, 400);

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

  try {
    await logActivity(
      req.user,
      {
        category: 'Inventory',
        action: 'ITEM_CREATED',
        description: `Created inventory item "${item.name}"`,
        reference: item.itemCode || item.code,
      },
      req
    );
  } catch (logErr) {
    console.error('logActivity error:', logErr);
  }

  res.status(201).json(item);
});

exports.updateItem = asyncHandler(async (req, res) => {
  // The item is loaded first so its current unit can be tolerated (see clean)
  const current = await InventoryItem.findOne({ code: req.params.code });
  if (!current) throw new AppError('Item not found.', 404);
  if (current.archived) {
    throw new AppError('This item is archived. Restore it before editing.', 400);
  }

  const { value, error } = clean(req.body, { keepUnit: squash(current.unit) });
  if (error) throw new AppError(error, 400);

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
    throw new AppError('Stock changed while you were editing. Close this and try again.', 409);
  }

  const item = updated;
  try {
    await logActivity(
      req.user,
      {
        category: 'Inventory',
        action: 'ITEM_UPDATED',
        description: `Updated inventory item "${item.name}"`,
        reference: item.itemCode || item.code,
      },
      req
    );
  } catch (logErr) {
    console.error('logActivity error:', logErr);
  }

  res.json(updated);
});

exports.adjustStock = asyncHandler(async (req, res) => {
  const { mode, amount, reference, remark } = req.body || {};
  if (!['add', 'remove'].includes(mode)) {
    throw new AppError('Choose receive or withdraw.', 400);
  }

  const amt = wholeNumber(amount, { label: 'Quantity', min: 1, max: LIMITS.maxQty });
  if (amt.error) throw new AppError(amt.error, 400);
  const qty = amt.value;

  const ref = squash(reference).toUpperCase(); // references are stored in capitals (DR-2026-114)
  const note = squash(remark);
  const textProblem =
    textError(ref, { label: 'Reference', max: LIMITS.reference, strip: STRIP.reference }) ||
    textError(note, { label: 'Remark', max: LIMITS.remark, strip: STRIP.remark });
  if (textProblem) throw new AppError(textProblem, 400);

  const target = await InventoryItem.findOne({ code: req.params.code }).select('archived');
  if (!target) throw new AppError('Item not found.', 404);
  if (target.archived) {
    throw new AppError('This item is archived. Restore it before adjusting stock.', 400);
  }

  // Receiving only matches while the new total stays within the limit (checked atomically)
  const match =
    mode === 'add'
      ? { code: req.params.code, quantity: { $lte: LIMITS.maxQty - qty } }
      : { code: req.params.code };

  const result = await moveStock(match, mode === 'add' ? qty : -qty, {
    by: actorOf(req),
    reference: ref,
    remark: note,
  });

  if (!result) {
    throw new AppError(
      mode === 'add'
        ? `Stock cannot go over ${LIMITS.maxQty.toLocaleString('en-PH')}. Enter a smaller quantity.`
        : 'Not enough stock on hand.',
      400
    );
  }

  const item = result.item;
  const adjustment = mode === 'add' ? qty : -qty;
  const reason = req.body.reason || req.body.remark || note || (adjustment > 0 ? 'Stock received' : 'Stock withdrawn');
  const newStock = item.quantity;
  const lowStockThreshold = item.lowStockThreshold !== undefined ? item.lowStockThreshold : item.reorderLevel;

  try {
    await logActivity(
      req.user,
      {
        category: 'Inventory',
        action: 'STOCK_ADJUSTED',
        description: `Adjusted stock for "${item.name}": ${adjustment > 0 ? '+' : ''}${adjustment} (${reason})`,
        reference: item.itemCode || item.code,
      },
      req
    );
  } catch (logErr) {
    console.error('logActivity error:', logErr);
  }

  if (typeof lowStockThreshold === 'number' && newStock <= lowStockThreshold) {
    try {
      const staff = await User.find({
        role: { $in: STAFF_ROLES },
        accountStatus: 'Active',
      }).select('_id');

      if (staff.length) {
        await Notification.insertMany(
          staff.map((s) => ({
            user: s._id,
            title: 'Low Stock Alert',
            message: `Item "${item.name}" is low on stock (${newStock} remaining).`,
            type: 'warning',
            link: '/staff/inventory',
          }))
        );
      }
    } catch (notifErr) {
      console.error('Low stock notification error:', notifErr);
    }
  }

  res.json(result.item);
});

// Which open requests (Pending, Processing, Approved) include this item?
// The Inventory page asks this before showing the archive confirmation.
exports.getOpenRequests = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findOne({ code: req.params.code }).select('name');
  if (!item) throw new AppError('Item not found.', 404);
  res.json({ openRequests: await openRequestsFor(item) });
});

// Archive: the item stays in the database with its full history, it is only hidden.
// Moderators and administrators can both archive, but not while a request still needs it.
exports.archiveItem = asyncHandler(async (req, res) => {
  const current = await InventoryItem.findOne({ code: req.params.code });
  if (!current) throw new AppError('Item not found.', 404);
  if (current.archived) throw new AppError('Item is already archived.', 400);

  const open = await openRequestsFor(current);
  if (open.length) {
    // Response carries an extra `openRequests` field, which AppError cannot hold,
    // so this one is sent directly to keep the exact original JSON shape.
    return res.status(409).json({ message: blockedMessage(current, open), openRequests: open });
  }

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
  if (!updated) throw new AppError('Item was already archived.', 409);

  try {
    await logActivity(
      req.user,
      {
        category: 'Inventory',
        action: 'ITEM_ARCHIVED',
        description: `Archived inventory item "${updated.name}"`,
        reference: updated.itemCode || updated.code,
      },
      req
    );
  } catch (logErr) {
    console.error('logActivity error:', logErr);
  }

  res.json(updated);
});

// Restore an archived item back to the active inventory
exports.restoreItem = asyncHandler(async (req, res) => {
  const current = await InventoryItem.findOne({ code: req.params.code });
  if (!current) throw new AppError('Item not found.', 404);
  if (!current.archived) throw new AppError('Item is not archived.', 400);

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
  if (!updated) throw new AppError('Item was already restored.', 409);

  try {
    await logActivity(
      req.user,
      {
        category: 'Inventory',
        action: 'ITEM_RESTORED',
        description: `Restored inventory item "${updated.name}"`,
        reference: updated.itemCode || updated.code,
      },
      req
    );
  } catch (logErr) {
    console.error('logActivity error:', logErr);
  }

  res.json(updated);
});

exports.STAFF_ROLES = STAFF_ROLES;
