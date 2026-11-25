const mongoose = require('mongoose');
const Requisition = require('../models/Requisition');
const Notification = require('../models/Notification');
const InventoryItem = require('../models/InventoryItem');
const User = require('../models/User');
const { deductForRequisition, restoreForRequisition } = require('../services/stock');
const { logActivity } = require('../services/activityLog');
const feedback = require('../services/feedback');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');

// YYYY-MM-DD in Philippine time (toISOString would use UTC and show the wrong day)
const fmtDate = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

// Name shown in the inventory history ("by ...")
const personName = (u) =>
  [u.firstName, u.lastName].filter((n) => n && n !== '-').join(' ') || u.email || 'Unknown user';

// What the requester sees under "Remarks" when no moderator note was written.
// Worked out on every read (never saved), so it always matches the current status
// and a moderator's own note always takes priority.
// Denied is left out on purpose: a denial always carries the moderator's reason.
const DEFAULT_REMARKS = {
  Pending: 'Awaiting moderator review.',
  Processing: 'Acknowledged by the moderator and now being processed.',
  Approved: 'Approved. Your items are ready for release at the Property Window.',
  Accepted: 'Items received. This request is complete.',
  Cancelled: 'Cancelled by the requester.',
};

// Shapes a DB document into what the React pages expect
const toClient = (r) => {
  const parts = r.itemsList.map((i) => `${i.name} (${i.qty})`);

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

    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    reviewedAt: r.reviewedAt,
    approvedAt: r.approvedAt,

    dateApproved: r.approvedAt ? fmtDate(r.approvedAt) : undefined,
    dateProcessed: r.processedAt ? fmtDate(r.processedAt) : 'Pending',
    status: r.status,
    requestedBy: requester ? requester.name : undefined,
    reviewedBy: r.reviewedBy || undefined,
    denyReason: r.status === 'Denied' ? r.remarks || undefined : undefined,
    remarks: r.remarks || DEFAULT_REMARKS[r.status] || '',
    previousStatus: r.previousStatus || undefined,
    itemsList: r.itemsList,
    requester,

    // Feedback: the "Send Feedback" button stays disabled once this is true
    feedbackSubmitted: !!r.feedbackSubmittedAt,
    feedbackSubmittedAt: r.feedbackSubmittedAt || undefined,
    // Turned on/off in System Settings. When false, the page hides "Send Feedback".
    feedbackEnabled: feedback.enabled(),
  };
};

// In-stock lines must point at a real inventory item.
// Name, unit and limit come from the database, not from the browser.
const buildStockLines = async (arr) => {
  const rows = (Array.isArray(arr) ? arr : []).filter((i) => i && String(i.name || '').trim());
  if (!rows.length) return { lines: [] };

  if (rows.some((i) => !mongoose.isValidObjectId(i.inventoryItemId))) {
    return { error: 'Pick each item from the inventory list.' };
  }

  const found = await InventoryItem.find({
    _id: { $in: rows.map((i) => i.inventoryItemId) },
  }).select('name unit quantity maxNormal');
  const byId = new Map(found.map((d) => [String(d._id), d]));

  const lines = [];
  const seen = new Set();
  for (const i of rows) {
    const inv = byId.get(String(i.inventoryItemId));
    const qty = Math.floor(Number(i.qty));
    const reason = String(i.reason || '').trim();

    if (!inv) return { error: `"${i.name}" is no longer in the inventory.` };
    if (seen.has(String(inv._id))) return { error: `${inv.name} is listed more than once.` };
    seen.add(String(inv._id));

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

  const { lines: itemsList, error: stockError } = await buildStockLines(body.itemsList);
  if (stockError) return { error: stockError };
  if (!itemsList.length) return { error: 'Add at least one item.' };

  return {
    data: {
      title,
      purpose,
      itemsList,
      department: String(body.department || '').trim(),
    },
  };
};

/**
 * Checks that every line of a slip can be released. Stock already promised to other
 * Approved slips (not yet received) is counted as taken. Read-only: nothing is deducted here.
 */
const findShortage = async (doc) => {
  const ids = doc.itemsList.map((i) => i.inventoryItemId).filter(Boolean);
  const [found, reservedRows] = await Promise.all([
    InventoryItem.find({ _id: { $in: ids } }).select('name unit quantity'),
    Requisition.aggregate([
      { $match: { status: 'Approved', _id: { $ne: doc._id } } },
      { $unwind: '$itemsList' },
      { $group: { _id: '$itemsList.inventoryItemId', qty: { $sum: '$itemsList.qty' } } },
    ]),
  ]);
  const byId = new Map(found.map((d) => [String(d._id), d]));
  const reserved = new Map(reservedRows.map((r) => [String(r._id), r.qty]));

  for (const line of doc.itemsList) {
    const inv = byId.get(String(line.inventoryItemId));
    if (!inv) return `"${line.name}" is no longer in the inventory.`;
    const available = inv.quantity - (reserved.get(String(inv._id)) || 0);
    if (line.qty > available) {
      return `Not enough ${inv.name}: ${Math.max(available, 0)} ${inv.unit} available (after items reserved for other approved slips), but ${line.qty} requested.`;
    }
  }
  return '';
};

/** GET /api/requisitions: the logged-in user's own slips */
exports.list = asyncHandler(async (req, res) => {
  const docs = await Requisition.find({ requester: req.user._id }).sort({ createdAt: -1 });
  res.json({ requisitions: docs.map(toClient) });
});

/** GET /api/requisitions/all: every slip (Moderator / Administrator only) */
exports.listAll = asyncHandler(async (req, res) => {
  const docs = await Requisition.find()
    .sort({ createdAt: -1 })
    .populate('requester', 'firstName lastName email idNumber');
  res.json({ requisitions: docs.map(toClient) });
});

// One notification for every active Moderator and Administrator (except the sender)
const notifyStaff = async (sender, title, message) => {
  const staff = await User.find({
    role: { $in: ['Moderator', 'Administrator'] },
    accountStatus: 'Active',
    _id: { $ne: sender._id },
  }).select('_id role');

  if (!staff.length) return;

  await Notification.insertMany(
    staff.map((s) => ({
      user: s._id,
      title,
      message,
      type: 'info',
      link: s.role === 'Administrator' ? '/admin/requests' : '/staff/requests',
    }))
  );
};

/** POST /api/requisitions */
exports.create = asyncHandler(async (req, res) => {
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

  notifyStaff(
    req.user,
    'New Requisition Filed',
    `${personName(req.user)} filed requisition slip ${doc.slipNumber} ("${doc.title}"). Review it in Requests.`
  ).catch((e) => console.error('notifyStaff error:', e));

  await logActivity(
    req.user,
    {
      category: 'Requisition',
      action: 'REQUISITION_FILED',
      description: `Filed requisition slip "${doc.title}"`,
      reference: doc.slipNumber,
    },
    req
  );

  res.status(201).json({ requisition: toClient(doc) });
});

/** PUT /api/requisitions/:slip: owner only, Pending only */
exports.update = asyncHandler(async (req, res) => {
  const doc = await Requisition.findOne({ slipNumber: req.params.slip, requester: req.user._id });
  if (!doc) throw new AppError('Requisition not found.', 404);
  if (doc.status !== 'Pending') {
    throw new AppError('Only pending requisitions can be edited.', 409);
  }

  const { data, error } = await parseBody(req.body);
  if (error) return res.status(400).json({ message: error });

  Object.assign(doc, data);
  await doc.save();

  await logActivity(
    req.user,
    {
      category: 'Requisition',
      action: 'REQUISITION_EDITED',
      description: `Edited requisition slip "${doc.title}"`,
      reference: doc.slipNumber,
    },
    req
  );

  res.json({ requisition: toClient(doc) });
});

/** PATCH /api/requisitions/:slip/cancel: owner only, Pending only. The slip is kept, not deleted. */
exports.cancel = asyncHandler(async (req, res) => {
  const doc = await Requisition.findOne({ slipNumber: req.params.slip, requester: req.user._id });
  if (!doc) throw new AppError('Requisition not found.', 404);
  if (doc.status !== 'Pending') {
    throw new AppError('Only pending requisitions can be cancelled.', 409);
  }

  doc.status = 'Cancelled';
  doc.cancelledAt = new Date();
  await doc.save();

  await logActivity(
    req.user,
    {
      category: 'Requisition',
      action: 'REQUISITION_CANCELLED',
      description: `Cancelled requisition slip "${doc.title}"`,
      reference: doc.slipNumber,
    },
    req
  );

  res.json({ requisition: toClient(doc) });
});

// What the requester is told for each status change
const STATUS_NOTIF = {
  Processing: { type: 'info', text: 'is now being processed.' },
  Approved: {
    type: 'success',
    text: 'has been approved. Your items are ready for release. Please proceed to the Property Window.',
  },
  Accepted: { type: 'success', text: 'is complete. The items were released and received.' },
  Denied: { type: 'warning', text: 'was denied.' },
};

// The moderator workflow only moves forward (administrators can step back with Undo)
const TRANSITIONS = {
  Pending: ['Processing', 'Denied'],
  Processing: ['Approved', 'Denied'],
  Approved: ['Accepted', 'Denied'], // Accepted = requester received the items; Denied = e.g. never claimed
};

/** PATCH /api/requisitions/:slip/status (Moderator / Administrator only) */
exports.setStatus = asyncHandler(async (req, res) => {
  const { status, expectedStatus } = req.body;
  const remarks = String(req.body.remarks || '').trim();

  if (!STATUS_NOTIF[status]) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  const hasExpectedStatus =
    expectedStatus !== undefined && expectedStatus !== null && expectedStatus !== '';
  if (hasExpectedStatus && typeof expectedStatus !== 'string') {
    return res.status(400).json({ message: 'Invalid expectedStatus.' });
  }

  const doc = await Requisition.findOne({ slipNumber: req.params.slip });
  if (!doc) throw new AppError('Requisition not found.', 404);

  if (hasExpectedStatus && doc.status !== expectedStatus) {
    throw new AppError(
      'This requisition was already updated by someone else. Please refresh.',
      409
    );
  }

  if (!(TRANSITIONS[doc.status] || []).includes(status)) {
    return res
      .status(409)
      .json({ message: `A ${doc.status.toLowerCase()} request can't be moved to ${status}.` });
  }
  if (status === 'Denied' && !remarks) {
    return res.status(400).json({ message: 'Please give a reason for the denial.' });
  }
  if (status === 'Approved' && !remarks) {
    return res.status(400).json({ message: 'Please add a remark for the requester.' });
  }

  // Approving means "ready for release", so the items must really be available.
  // Nothing is deducted yet.
  if (status === 'Approved') {
    const shortage = await findShortage(doc);
    if (shortage) return res.status(409).json({ message: shortage });
  }

  const now = new Date();
  const actor = personName(req.user);
  const setFields = {
    status,
    reviewedBy: actor,
    reviewedAt: now,
  };
  if (remarks) setFields.remarks = remarks; // Approved: the pick-up note. Denied: the reason the requester sees.
  if (status === 'Approved') setFields.approvedAt = now;
  if (status === 'Accepted' || status === 'Denied') setFields.processedAt = now;

  // Remember where a denied slip came from, so an administrator's Undo can restore it
  if (status === 'Denied') {
    setFields.previousStatus = doc.status; // Pending, Processing or Approved
    setFields.previousRemarks = doc.remarks || '';
  }

  // Claim the transition atomically before deducting stock
  const updated = await Requisition.findOneAndUpdate(
    {
      slipNumber: req.params.slip,
      status: doc.status,
    },
    { $set: setFields },
    { new: true }
  );
  if (!updated) {
    throw new AppError(
      'This requisition was already updated by someone else. Please refresh.',
      409
    );
  }

  // Accepted = the requester received the items. Only now is the inventory reduced.
  // If anything is short, revert the status and rethrow the error.
  let stock = null;
  if (status === 'Accepted') {
    try {
      stock = await deductForRequisition(updated._id, actor);
    } catch (err) {
      const revertSet = {
        status: doc.status,
        reviewedBy: doc.reviewedBy || '',
        remarks: doc.remarks || '',
      };
      const revertUnset = {};
      if (doc.reviewedAt) revertSet.reviewedAt = doc.reviewedAt;
      else revertUnset.reviewedAt = '';
      if (doc.processedAt) revertSet.processedAt = doc.processedAt;
      else revertUnset.processedAt = '';

      const revertUpdate = Object.keys(revertUnset).length
        ? { $set: revertSet, $unset: revertUnset }
        : { $set: revertSet };

      try {
        await Requisition.findOneAndUpdate(
          { _id: updated._id, status: 'Accepted' },
          revertUpdate
        );
      } catch (revertErr) {
        console.error(
          `Failed to revert status for ${updated.slipNumber} after deduction failure (stock was NOT deducted):`,
          revertErr
        );
      }
      throw new AppError(err.message, 409);
    }
  }

  const n = STATUS_NOTIF[status];
  await Notification.create({
    user: updated.requester,
    title: `Requisition ${status}`,
    message: `Your requisition slip ${updated.slipNumber} ${n.text}${remarks ? ` Remarks: ${remarks}` : ''}`,
    type: n.type,
    link: '/user/requests',
  });

  await logActivity(
    req.user,
    {
      category: 'Requisition',
      action: 'REQUISITION_STATUS',
      description: `Changed requisition slip "${updated.title}" to ${status}`,
      reference: updated.slipNumber,
    },
    req
  );

  res.json({ requisition: toClient(updated), stock });
});

// Where Undo sends a slip back to (Denied goes back to where it was before the denial)
const UNDO_TARGET = { Processing: 'Pending', Approved: 'Processing', Accepted: 'Approved' };

/** POST /api/requisitions/:slip/undo (Administrator only) */
exports.undo = asyncHandler(async (req, res) => {
  const doc = await Requisition.findOne({ slipNumber: req.params.slip });
  if (!doc) throw new AppError('Requisition not found.', 404);

  const from = doc.status;
  const target = from === 'Denied' ? doc.previousStatus || 'Pending' : UNDO_TARGET[from];
  if (!target) {
    return res.status(409).json({ message: `A ${from.toLowerCase()} request can't be undone.` });
  }

  // Undoing a denial back to Approved: the items must still be available
  if (from === 'Denied' && target === 'Approved') {
    const shortage = await findShortage(doc);
    if (shortage) return res.status(409).json({ message: shortage });
  }

  // Accepted -> Approved: put the deducted stock back first
  let stock = null;
  if (from === 'Accepted') {
    try {
      stock = await restoreForRequisition(doc._id, personName(req.user));
    } catch (err) {
      return res.status(409).json({ message: err.message });
    }
  }

  // Clear what the undone step had set
  if (from === 'Approved') {
    doc.approvedAt = undefined;
    doc.remarks = '';
  }
  if (from === 'Accepted') doc.processedAt = undefined;
  if (from === 'Denied') {
    doc.processedAt = undefined;
    doc.remarks = doc.previousRemarks || '';
    doc.previousStatus = '';
    doc.previousRemarks = '';
  }

  doc.status = target;
  if (target === 'Pending') {
    doc.reviewedBy = '';
    doc.reviewedAt = undefined;
  } else {
    doc.reviewedBy = personName(req.user);
    doc.reviewedAt = new Date();
  }
  await doc.save();

  await Notification.create({
    user: doc.requester,
    title: `Requisition moved back to ${target}`,
    message: `Your requisition slip ${doc.slipNumber} was moved back to ${target} after a correction by an administrator.`,
    type: 'info',
    link: '/user/requests',
  });

  await logActivity(
    req.user,
    {
      category: 'Requisition',
      action: 'REQUISITION_UNDO',
      description: `Undid requisition slip "${doc.title}": ${from} to ${target}`,
      reference: doc.slipNumber,
    },
    req
  );

  res.json({ requisition: toClient(doc), stock });
});