const mongoose = require('mongoose');
const Requisition = require('../models/Requisition');
const Notification = require('../models/Notification');
const InventoryItem = require('../models/InventoryItem');
const { deductForRequisition } = require('../services/stock');

const SERVER_ERROR = { message: 'Something went wrong. Please try again.' };

// YYYY-MM-DD in Philippine time (toISOString would use UTC and show the wrong day)
const fmtDate = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

// Name shown in the inventory history ("by ...")
const personName = (u) =>
  [u.firstName, u.lastName].filter((n) => n && n !== '-').join(' ') || u.email || 'Unknown user';

// What the requester sees under "Remarks" when no moderator note was written.
// Worked out each time a slip is read and never saved, so it always matches the
// slip's current status and a moderator's own note always takes priority.
// Denied is left out on purpose: a denial always carries the moderator's reason.
const DEFAULT_REMARKS = {
  Pending: 'Awaiting moderator review.',
  Processing: 'Acknowledged by the moderator and now being processed.',
  Purchasing: 'Waiting for items to be purchased or restocked.',
  Accepted: 'Approved. Please proceed to the Property Window for pickup.',
  Cancelled: 'Cancelled by the requester.',
};

// Shapes a DB document into what the React pages expect
const toClient = (r) => {
  const parts = [
    ...r.itemsList.map((i) => `${i.name} (${i.qty})`),
    ...r.purchaseItems.map((i) => `${i.name} (${i.qty})`),
  ];

  // Only present when the requester was populated (staff views)
  const requester =
    r.requester && r.requester.firstName
      ? {
          name: [r.requester.firstName, r.requester.lastName]
            .filter((n) => n && n !== '-')
            .join(' '),
          email: r.requester.email,
          idNumber: r.requester.idNumber || null,
        }
      : undefined;

  return {
    id: r.slipNumber,
    department: r.department,
    title: r.title,
    purpose: r.purpose,
    item: parts.join(', '),
    date: fmtDate(r.createdAt),
    dateFiled: fmtDate(r.createdAt),
    dateProcessed: r.processedAt ? fmtDate(r.processedAt) : 'Pending',
    status: r.status,
    requestedBy: requester ? requester.name : undefined,
    reviewedBy: r.reviewedBy || undefined,
    reviewedAt: r.reviewedAt || undefined,
    denyReason: r.status === 'Denied' ? r.remarks || undefined : undefined,
    remarks: r.remarks || DEFAULT_REMARKS[r.status] || '',
    itemsList: r.itemsList,
    purchaseItems: r.purchaseItems,
    requester,
  };
};

// External purchase items: free text, nothing to look up
const cleanItems = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .filter((i) => i && typeof i.name === 'string' && i.name.trim())
    .map((i) => ({
      name: i.name.trim(),
      qty: Math.floor(Number(i.qty)),
      reason: String(i.reason || '').trim(),
      maxNormal: Number(i.maxNormal) || undefined,
    }));

// In-stock lines must point at a real inventory item.
// Name, unit and limit come from the database, not from the browser.
const buildStockLines = async (arr) => {
  const rows = (Array.isArray(arr) ? arr : []).filter((i) => i && String(i.name || '').trim());
  if (!rows.length) return { lines: [] };

  if (rows.some((i) => !mongoose.isValidObjectId(i.inventoryItemId))) {
    return { error: 'Pick each stock item from the inventory list.' };
  }

  const found = await InventoryItem.find({
    _id: { $in: rows.map((i) => i.inventoryItemId) },
  }).select('name unit quantity maxNormal');
  const byId = new Map(found.map((d) => [String(d._id), d]));

  const lines = [];
  for (const i of rows) {
    const inv = byId.get(String(i.inventoryItemId));
    const qty = Math.floor(Number(i.qty));
    const reason = String(i.reason || '').trim();

    if (!inv) return { error: `"${i.name}" is no longer in the inventory.` };
    if (!(qty >= 1)) return { error: 'Every item needs a quantity of at least 1.' };
    if (qty > inv.quantity)
      return { error: `Only ${inv.quantity} ${inv.unit} of ${inv.name} in stock.` };
    if (qty > inv.maxNormal && !reason) {
      return { error: `${inv.name}: please explain why you need more than ${inv.maxNormal}.` };
    }
    lines.push({
      inventoryItemId: inv._id,
      name: inv.name,
      unit: inv.unit,
      qty,
      reason,
      maxNormal: inv.maxNormal,
    });
  }
  return { lines };
};

// Validates and returns the editable fields (never status/id/date)
const parseBody = async (body) => {
  const title = String(body.title || '').trim();
  const purpose = String(body.purpose || '').trim();
  if (!title || !purpose) return { error: 'Title and purpose are required.' };

  const purchaseItems = cleanItems(body.purchaseItems);
  if (purchaseItems.some((i) => !(i.qty >= 1))) {
    return { error: 'Every item needs a quantity of at least 1.' };
  }

  const { lines: itemsList, error: stockError } = await buildStockLines(body.itemsList);
  if (stockError) return { error: stockError };

  if (!itemsList.length && !purchaseItems.length) return { error: 'Add at least one item.' };

  return {
    data: {
      title,
      purpose,
      itemsList,
      purchaseItems,
      department: String(body.department || '').trim(),
    },
  };
};

/** GET /api/requisitions: the logged-in user's own slips */
exports.list = async (req, res) => {
  try {
    const docs = await Requisition.find({ requester: req.user._id }).sort({ createdAt: -1 });
    res.json({ requisitions: docs.map(toClient) });
  } catch (err) {
    console.error('list requisitions error:', err);
    res.status(500).json(SERVER_ERROR);
  }
};

/** GET /api/requisitions/all: every slip (Moderator / Administrator only) */
exports.listAll = async (req, res) => {
  try {
    const docs = await Requisition.find()
      .sort({ createdAt: -1 })
      .populate('requester', 'firstName lastName email idNumber');
    res.json({ requisitions: docs.map(toClient) });
  } catch (err) {
    console.error('listAll requisitions error:', err);
    res.status(500).json(SERVER_ERROR);
  }
};

/** POST /api/requisitions */
exports.create = async (req, res) => {
  try {
    const { data, error } = await parseBody(req.body);
    if (error) return res.status(400).json({ message: error });

    const doc = await Requisition.create({
      ...data,
      requester: req.user._id,
      slipNumber: await Requisition.nextSlipNumber(),
      status: 'Pending',
    });

    await Notification.create({
      user: req.user._id,
      title: 'New Status Update: Pending',
      message: `Your requisition slip ${doc.slipNumber} has been submitted and is awaiting moderator review.`,
      type: 'info',
      link: '/user/requests',
    });

    res.status(201).json({ requisition: toClient(doc) });
  } catch (err) {
    console.error('create requisition error:', err);
    res.status(500).json(SERVER_ERROR);
  }
};

/** PUT /api/requisitions/:slip: owner only, Pending only */
exports.update = async (req, res) => {
  try {
    const doc = await Requisition.findOne({ slipNumber: req.params.slip, requester: req.user._id });
    if (!doc) return res.status(404).json({ message: 'Requisition not found.' });
    if (doc.status !== 'Pending') {
      return res.status(409).json({ message: 'Only pending requisitions can be edited.' });
    }

    const { data, error } = await parseBody(req.body);
    if (error) return res.status(400).json({ message: error });

    Object.assign(doc, data);
    await doc.save();
    res.json({ requisition: toClient(doc) });
  } catch (err) {
    console.error('update requisition error:', err);
    res.status(500).json(SERVER_ERROR);
  }
};

/** PATCH /api/requisitions/:slip/cancel: owner only, Pending only. The slip is kept, not deleted. */
exports.cancel = async (req, res) => {
  try {
    const doc = await Requisition.findOne({ slipNumber: req.params.slip, requester: req.user._id });
    if (!doc) return res.status(404).json({ message: 'Requisition not found.' });
    if (doc.status !== 'Pending') {
      return res.status(409).json({ message: 'Only pending requisitions can be cancelled.' });
    }

    doc.status = 'Cancelled';
    doc.cancelledAt = new Date();
    await doc.save();

    res.json({ requisition: toClient(doc) });
  } catch (err) {
    console.error('cancel requisition error:', err);
    res.status(500).json(SERVER_ERROR);
  }
};

// What the student is told for each status change
const STATUS_NOTIF = {
  Processing: { type: 'info', text: 'is now being processed.' },
  Purchasing: { type: 'info', text: 'has been forwarded for purchasing.' },
  Accepted: {
    type: 'success',
    text: 'has been approved. Please proceed to the Property Window for pickup.',
  },
  Denied: { type: 'warning', text: 'was denied.' },
};

// The moderator workflow only moves forward
const TRANSITIONS = {
  Pending: ['Processing', 'Denied'],
  Processing: ['Purchasing', 'Accepted', 'Denied'],
  Purchasing: ['Accepted', 'Denied'],
};

/** PATCH /api/requisitions/:slip/status (Moderator / Administrator only) */
exports.setStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const remarks = String(req.body.remarks || '').trim();

    if (!STATUS_NOTIF[status]) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const doc = await Requisition.findOne({ slipNumber: req.params.slip });
    if (!doc) return res.status(404).json({ message: 'Requisition not found.' });

    if (!(TRANSITIONS[doc.status] || []).includes(status)) {
      return res
        .status(409)
        .json({ message: `A ${doc.status.toLowerCase()} request can't be moved to ${status}.` });
    }
    if (status === 'Denied' && !remarks) {
      return res.status(400).json({ message: 'Please give a reason for the denial.' });
    }
    if (status === 'Accepted' && doc.status === 'Processing' && doc.purchaseItems.length > 0) {
      return res
        .status(409)
        .json({ message: 'This request has items to buy. Send it to purchasing first.' });
    }

    // Approving takes the items out of the inventory. If anything is short, nothing changes.
    let stock = null;
    if (status === 'Accepted') {
      try {
        stock = await deductForRequisition(doc._id, personName(req.user));
      } catch (err) {
        return res.status(409).json({ message: err.message });
      }
    }

    doc.status = status;
    if (remarks) doc.remarks = remarks; // for Denied this is the reason the student sees
    doc.reviewedBy = personName(req.user);
    doc.reviewedAt = new Date();
    if (status === 'Accepted' || status === 'Denied') doc.processedAt = new Date();
    await doc.save();

    const n = STATUS_NOTIF[status];
    await Notification.create({
      user: doc.requester,
      title: `Requisition ${status}`,
      message: `Your requisition slip ${doc.slipNumber} ${n.text}${remarks ? ` Remarks: ${remarks}` : ''}`,
      type: n.type,
      link: '/user/requests',
    });

    res.json({ requisition: toClient(doc), stock });
  } catch (err) {
    console.error('setStatus error:', err);
    res.status(500).json(SERVER_ERROR);
  }
};
