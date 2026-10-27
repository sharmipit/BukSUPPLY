const express = require('express');
const axios = require('axios');
const InventoryItem = require('../models/InventoryItem');
const Requisition = require('../models/Requisition');
const ExportHistory = require('../models/ExportHistory');
const { protect, restrictTo } = require('../middleware/auth');
const { buildXlsx } = require('../services/reportFiles');

const router = express.Router();

// Reports are staff only
router.use(protect, restrictTo('Moderator', 'Administrator'));

const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const TYPES = ['stocks', 'requests', 'transactions'];
const FORMATS = ['pdf', 'xlsx'];
const FILTER_KEYS = ['category', 'status', 'type', 'from', 'to'];

const TITLES = {
  stocks: 'Stock Report',
  requests: 'Requests Report',
  transactions: 'Transactions Report',
};

const COLUMNS = {
  stocks: [
    { header: 'Code', key: 'id' },
    { header: 'Item', key: 'name' },
    { header: 'Category', key: 'category' },
    { header: 'Quantity', key: 'quantity' },
    { header: 'Unit', key: 'unit' },
    { header: 'Reorder Level', key: 'reorderLevel' },
    { header: 'Status', key: 'status' },
  ],
  requests: [
    { header: 'Slip #', key: 'id' },
    { header: 'Requested by', key: 'requester' },
    { header: 'Department', key: 'department' },
    { header: 'Title', key: 'title' },
    { header: 'Items', key: 'items' },
    { header: 'Status', key: 'status' },
    { header: 'Date Filed', key: 'createdAt' },
  ],
  transactions: [
    { header: 'Date', key: 'createdAt' },
    { header: 'Code', key: 'code' },
    { header: 'Item', key: 'item' },
    { header: 'Type', key: 'type' },
    { header: 'Qty', key: 'quantity' },
    { header: 'Before', key: 'before' },
    { header: 'After', key: 'after' },
    { header: 'Done by', key: 'user' },
    { header: 'Remark', key: 'remark' },
  ],
};

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
  if (str(q.category)) filter.category = str(q.category);

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

  if (str(q.status)) rows = rows.filter((r) => r.status === str(q.status));
  return rows;
}

async function requestsRows(q) {
  const filter = {};
  if (str(q.status)) filter.status = str(q.status);
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
  if (str(q.type)) match['movements.type'] = str(q.type);
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
        remark: '$movements.remark',
      },
    },
  ]);
}

const loaders = { stocks: stocksRows, requests: requestsRows, transactions: transactionsRows };

// Helper to convert rows into styled HTML for PDFShift
function generateHtmlReport(type, rows, summary) {
  const cols = COLUMNS[type] || [];
  const title = TITLES[type] || 'Report';

  const tableHeaders = cols.map((col) => `<th>${col.header}</th>`).join('');
  const tableRows = rows
    .map((row) => {
      const cells = cols
        .map((col) => {
          const val = row[col.key] ?? '';
          return `<td>${val}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 30px; color: #1e293b; }
          h2 { color: #1e40af; margin-bottom: 4px; }
          .summary { color: #64748b; font-size: 12px; margin-bottom: 4px; }
          .meta { color: #94a3b8; font-size: 11px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          th { background-color: #1e40af; color: #ffffff; font-weight: bold; }
          tr:nth-child(even) { background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <h2>BukSUPPLY – ${title}</h2>
        <div class="summary">${summary}</div>
        <div class="meta">Generated ${new Date().toLocaleString('en-PH')} · ${rows.length} record(s)</div>
        <table>
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

// Function to call PDFShift API
async function generatePdfShift(type, rows, summary) {
  const html = generateHtmlReport(type, rows, summary);

  const response = await axios.post(
    'https://api.pdfshift.io/v3/convert/pdf',
    {
      source: html,
      landscape: true,
    },
    {
      headers: {
        'X-API-Key': process.env.PDFSHIFT_API_KEY,
        'Content-Type': 'application/json',
      },
      auth: {
        username: process.env.PDFSHIFT_API_KEY,
        password: '',
      },
      responseType: 'arraybuffer',
    }
  );

  return Buffer.from(response.data);
}

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

// ---------- Raw JSON Endpoint ----------
router.get('/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!TYPES.includes(type)) {
      return res.status(400).json({ message: 'Invalid report type.' });
    }

    const rows = await loaders[type](req.query);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// ---------- File export (the one the frontend calls) ----------
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

    let file;
    try {
      file =
        format === 'pdf'
          ? await generatePdfShift(type, rows, summary)
          : await buildXlsx(type, rows, summary);
    } catch (err) {
      console.error('Report generation failed:', err.response?.data?.toString() || err.message);
      return res.status(502).json({ message: 'Could not generate the file. Please try again.' });
    }

    // Logged by the server
    await ExportHistory.create({ report: type, format, filters, user: actorOf(req) });

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
