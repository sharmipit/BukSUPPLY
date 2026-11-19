const crypto = require('crypto');
const InventoryItem = require('../models/InventoryItem');
const Requisition = require('../models/Requisition');
const ExportHistory = require('../models/ExportHistory');
const {
  buildPdf,
  buildXlsx,
  buildIssuancePdf,
  buildIssuanceXlsx,
} = require('../services/reportFiles');
const { deliverToDrive } = require('../services/googleDrive');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');

const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const TYPES = ['stocks', 'requests', 'transactions'];
const FORMATS = ['pdf', 'xlsx'];
const FILTER_KEYS = ['category', 'status', 'type', 'from', 'to'];

// Names used in the Drive email
const TITLE_OF = {
  stocks: 'Stock Report',
  requests: 'Requests Report',
  transactions: 'Transactions Report',
};

// One place for the file MIME types
const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

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

// Runs after the response. A Drive or email problem can never break the download,
// including a rejected promise or a synchronous throw from deliverToDrive.
function deliverQuietly(args) {
  try {
    Promise.resolve(deliverToDrive(args)).catch((err) =>
      console.error('Drive delivery failed:', err && err.message)
    );
  } catch (err) {
    console.error('Drive delivery failed:', err && err.message);
  }
}

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

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// ---------- History ----------
exports.getHistory = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 100);
  res.json(await ExportHistory.find().sort({ createdAt: -1 }).limit(limit));
});

exports.createHistory = asyncHandler(async (req, res) => {
  const { report, format, filters } = req.body;
  const historyItem = await ExportHistory.create({
    report,
    format,
    filters,
    user: actorOf(req),
  });
  res.status(201).json(historyItem);
});

// ---------- Verify a report by the code printed in its footer ----------
exports.verifyReport = asyncHandler(async (req, res) => {
  const code = str(req.params.code).toUpperCase();
  const record = await ExportHistory.findOne({ code });
  if (!record) {
    throw new AppError('No report was issued with that code.', 404);
  }
  res.json(record);
});

// ---------- Issuance slip (PDF or editable Excel for one requisition) ----------
// ?format=pdf (default) or ?format=xlsx
exports.exportIssuance = asyncHandler(async (req, res) => {
  const format = str(req.query.format) || 'pdf';
  if (!FORMATS.includes(format)) {
    throw new AppError('Invalid format.', 400);
  }

  // Adjust field names (slipNumber, reviewedAt, reviewedBy, remarks) to your Requisition model
  const slip = await Requisition.findOne({ slipNumber: str(req.params.slip) })
    .populate('requester', 'firstName lastName email')
    .lean();
  if (!slip) throw new AppError('Requisition not found.', 404);
  if (!['Approved', 'Accepted'].includes(slip.status)) {
    throw new AppError('Only approved or claimed requests have an issuance slip.', 400);
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

  // Intentional try/catch: "turned off by the administrator" (userFacing) is safe to show
  // as 403; anything else stays a generic 502.
  let file;
  try {
    file =
      format === 'xlsx'
        ? await buildIssuanceXlsx(slipData, lines, meta)
        : await buildIssuancePdf(slipData, lines, meta);
  } catch (err) {
    console.error('Issuance slip generation failed:', err.message);
    if (err.userFacing) throw new AppError(err.message, 403);
    throw new AppError('Could not generate the file. Please try again.', 502);
  }

  // Keep the record so the Drive step can update it
  const history = await ExportHistory.create({
    report: 'issuance',
    format,
    filters: { slip: slipData.id },
    user: meta.generatedBy,
    code: meta.code,
    recordCount: lines.length,
  });

  const safeId = String(slipData.id).replace(/[^\w.-]/g, '_');
  const filename = `issuance-slip-${safeId}.${format}`;

  res.setHeader('Content-Type', MIME[format]);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(file);

  deliverQuietly({
    buffer: file,
    filename,
    mimeType: MIME[format],
    user: req.user,
    label: 'Issuance Slip',
    historyId: history._id,
    code: meta.code,
  });
});

// ---------- Raw JSON endpoint (also used by the preview) ----------
exports.getReport = asyncHandler(async (req, res) => {
  const { type } = req.params;
  if (!TYPES.includes(type)) {
    throw new AppError('Invalid report type.', 400);
  }

  res.json(await loaders[type](req.query));
});

// ---------- File export ----------
exports.exportReport = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const format = str(req.query.format);
  if (!TYPES.includes(type) || !FORMATS.includes(format)) {
    throw new AppError('Invalid report or format.', 400);
  }

  const rows = await loaders[type](req.query);
  if (!rows.length) {
    throw new AppError('No records match the selected filters.', 400);
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
    if (err.userFacing) throw new AppError(err.message, 403);
    throw new AppError('Could not generate the file. Please try again.', 502);
  }

  // Logged by the server. The code in the file footer matches this record.
  // Keep the record so the Drive step can update it
  const history = await ExportHistory.create({
    report: type,
    format,
    filters,
    user: meta.generatedBy,
    code: meta.code,
    recordCount: rows.length,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${type}-report-${stamp}.${format}`;

  res.setHeader('Content-Type', MIME[format]);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(file);

  deliverQuietly({
    buffer: file,
    filename,
    mimeType: MIME[format],
    user: req.user,
    label: TITLE_OF[type],
    historyId: history._id,
    code: meta.code,
  });
});
