const crypto = require('crypto');
const express = require('express');
const InventoryItem = require('../models/InventoryItem');
const Requisition = require('../models/Requisition');
const ExportHistory = require('../models/ExportHistory');
const { protect, restrictTo } = require('../middleware/auth');
const {
  buildPdf,
  buildXlsx,
  buildIssuancePdf,
  buildIssuanceXlsx,
} = require('../services/reportFiles');

const router = express.Router();

// Reports are staff only
router.use(protect, restrictTo('Moderator', 'Administrator'));

const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const TYPES = ['stocks', 'requests', 'transactions'];
const FORMATS = ['pdf', 'xlsx'];
const FILTER_KEYS = ['category', 'status', 'type', 'from', 'to'];

// Verification code printed in the report footer, e.g. BSR-2026-1A2B3C4D
const makeCode = () =>
  `BSR-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

// Dates are picked in Philippine time (UTC+8); "to" includes the whole day
function dateRange(q) {
  const range = {};
  if (isDay(str(q.from))) range.$gte = new Date(`${q.from}T00:00:00+08:00`);
  if (isDay(str(q.to))) range.$lte = new Date(`${q.to}T23:59:59.999+08:00`);
  return Object.keys(range).length ? range : null;
}

const stockStatus = (i) =>
  i.quantity <= 0 ? 'Out of Stock' : i.quantity <= i.reorderLevel ? 'Low Stock' : 'In Stock';

const nameOf = (u) =>
  u ? [u.firstName, u.lastName].filter((n) => n && n !== '-').join(' ') || u.email || '' : '';

const actorOf = (req) => nameOf(req.user) || 'Unknown user';

const pickFilters = (q = {}) => {
  const out = {};
  FILTER_KEYS.forEach((k) => {
    if (str(q[k]) && str(q[k]) !== 'All') out[k] = str(q[k]);
  });
  return out;
};

// ---------- Data loaders (shared by JSON and file export) ----------
async function stocksRows(q) {
  const filter = {};
  if (str(q.category) && str(q.category) !== 'All') filter.category = str(q.category);

  const items = await InventoryItem.find(filter).sort({ category: 1, name: 1 }).lean();
  let rows = items.map((i) => ({
    id: i.code,
    name: i.name,
    category: i.category,
    quantity: i.quantity,
    unit: i.unit,
    reorderLevel: i.reorderLevel,
    status: stockStatus(i),
    updatedAt: i.updatedAt,
  }));

  if (str(q.status) && str(q.status) !== 'All')
    rows = rows.filter((r) => r.status === str(q.status));
  return rows;
}

async function requestsRows(q) {
  const filter = {};
  if (str(q.status) && str(q.status) !== 'All') filter.status = str(q.status);
  const range = dateRange(q);
  if (range) filter.createdAt = range;

  const slips = await Requisition.find(filter)
    .sort({ createdAt: -1 })
    .populate('requester', 'firstName lastName email')
    .lean();

  return slips.map((s) => ({
    id: s.slipNumber,
    requester: nameOf(s.requester),
    department: s.department,
    title: s.title,
    items: [
      ...(s.itemsList || []).map((i) => `${i.name} x${i.qty}`),
      ...(s.purchaseItems || []).map((i) => `${i.name} x${i.qty} (purchase)`),
    ].join(', '),
    status: s.status,
    createdAt: s.createdAt,
  }));
}

async function transactionsRows(q) {
  const match = {};
  if (str(q.type) && str(q.type) !== 'All') match['movements.type'] = str(q.type);
  const range = dateRange(q);
  if (range) match['movements.date'] = range;

  return InventoryItem.aggregate([
    { $unwind: '$movements' },
    { $match: match },
    { $sort: { 'movements.date': -1 } },
    {
      $project: {
        _id: 0,
        createdAt: '$movements.date',
        code: '$code',
        item: '$name',
        type: '$movements.type',
        quantity: '$movements.qty',
        before: '$movements.before',
        after: '$movements.after',
        user: '$movements.by',
        reference: '$movements.reference',
      },
    },
  ]);
}

const loaders = { stocks: stocksRows, requests: requestsRows, transactions: transactionsRows };

// ---------- History ----------
router.get('/history', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 100);
    res.json(await ExportHistory.find().sort({ createdAt: -1 }).limit(limit));
  } catch (e) {
    next(e);
  }
});

router.post('/history', async (req, res, next) => {
  try {
    const { report, format, filters } = req.body;
    const historyItem = await ExportHistory.create({
      report,
      format,
      filters,
      user: actorOf(req),
    });
    res.status(201).json(historyItem);
  } catch (e) {
    next(e);
  }
});

// ---------- Verify a report by the code printed in its footer ----------
router.get('/verify/:code', async (req, res, next) => {
  try {
    const code = str(req.params.code).toUpperCase();
    const record = await ExportHistory.findOne({ code });
    if (!record) {
      return res.status(404).json({ message: 'No report was issued with that code.' });
    }
    res.json(record);
  } catch (e) {
    next(e);
  }
});

// ---------- Issuance slip (PDF or editable Excel for one requisition) ----------
// ?format=pdf (default) or ?format=xlsx
// Must stay above '/:type' so "issuance" is never read as a report type.
router.get('/issuance/:slip/export', async (req, res, next) => {
  try {
    const format = str(req.query.format) || 'pdf';
    if (!FORMATS.includes(format)) {
      return res.status(400).json({ message: 'Invalid format.' });
    }

    // Adjust field names (slipNumber, reviewedAt, reviewedBy, remarks) to your Requisition model
    const slip = await Requisition.findOne({ slipNumber: str(req.params.slip) })
      .populate('requester', 'firstName lastName email')
      .lean();
    if (!slip) return res.status(404).json({ message: 'Requisition not found.' });
    if (!['Approved', 'Accepted'].includes(slip.status)) {
      return res
        .status(400)
        .json({ message: 'Only approved or claimed requests have an issuance slip.' });
    }

    // Unit and stock number live on the inventory item
    const inv = await InventoryItem.find({}, 'name unit code').lean();
    const key = (s) =>
      String(s || '')
        .trim()
        .toLowerCase();
    const invFor = (l) =>
      inv.find((i) => String(i._id) === String(l.inventoryItemId)) ||
      inv.find((i) => key(i.name) === key(l.name));

    const lines = [...(slip.itemsList || []), ...(slip.purchaseItems || [])].map((l) => {
      const item = invFor(l);
      return {
        code: item?.code || '',
        name: l.name,
        qty: l.qty,
        unit: item?.unit || l.unit || '',
      };
    });

    const slipData = {
      id: slip.slipNumber,
      requestedBy: nameOf(slip.requester),
      department: slip.department,
      purpose: slip.purpose,
      filedAt: slip.createdAt,
      approvedAt: slip.reviewedAt,
      approvedBy: typeof slip.reviewedBy === 'object' ? nameOf(slip.reviewedBy) : slip.reviewedBy,
      remarks: slip.remarks,
    };

    // Printed in the file footer and saved in the history so it can be verified later
    const meta = { code: makeCode(), generatedBy: actorOf(req), generatedAt: new Date() };

    let file;
    try {
      file =
        format === 'xlsx'
          ? await buildIssuanceXlsx(slipData, lines, meta)
          : await buildIssuancePdf(slipData, lines, meta);
    } catch (err) {
      console.error('Issuance slip generation failed:', err.message);
      if (err.userFacing) return res.status(403).json({ message: err.message });
      return res.status(502).json({ message: 'Could not generate the file. Please try again.' });
    }

    await ExportHistory.create({
      report: 'issuance',
      format,
      filters: { slip: slipData.id },
      user: meta.generatedBy,
      code: meta.code,
      recordCount: lines.length,
    });

    const safeId = String(slipData.id).replace(/[^\w.-]/g, '_');
    res.setHeader(
      'Content-Type',
      format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="issuance-slip-${safeId}.${format}"`
    );
    res.send(file);
  } catch (e) {
    next(e);
  }
});

// ---------- Raw JSON endpoint (also used by the preview) ----------
router.get('/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!TYPES.includes(type)) {
      return res.status(400).json({ message: 'Invalid report type.' });
    }

    res.json(await loaders[type](req.query));
  } catch (e) {
    next(e);
  }
});

// ---------- File export ----------
router.get('/:type/export', async (req, res, next) => {
  try {
    const { type } = req.params;
    const format = str(req.query.format);
    if (!TYPES.includes(type) || !FORMATS.includes(format)) {
      return res.status(400).json({ message: 'Invalid report or format.' });
    }

    const rows = await loaders[type](req.query);
    if (!rows.length) {
      return res.status(400).json({ message: 'No records match the selected filters.' });
    }

    const filters = pickFilters(req.query);
    const summary = Object.keys(filters).length
      ? Object.entries(filters)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ')
      : 'All records';

    // Printed in the file header/footer and saved in the history so it can be verified later
    const meta = { code: makeCode(), generatedBy: actorOf(req), generatedAt: new Date() };

    let file;
    try {
      file =
        format === 'pdf'
          ? await buildPdf(type, rows, summary, meta)
          : await buildXlsx(type, rows, summary, meta);
    } catch (err) {
      console.error('Report generation failed:', err.message);
      // "Turned off by the administrator" is safe to show; other errors stay generic
      if (err.userFacing) return res.status(403).json({ message: err.message });
      return res.status(502).json({ message: 'Could not generate the file. Please try again.' });
    }

    // Logged by the server. The code in the file footer matches this record.
    await ExportHistory.create({
      report: type,
      format,
      filters,
      user: meta.generatedBy,
      code: meta.code,
      recordCount: rows.length,
    });

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${type}-report-${stamp}.${format}"`
    );
    res.send(file);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
