const ExcelJS = require('exceljs');

const TITLES = {
  stocks: 'Stock Report',
  requests: 'Requests Report',
  transactions: 'Transactions Report',
};

const fmtDate = (v) =>
  v
    ? new Date(v).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Manila',
      })
    : '';

const COLUMNS = {
  stocks: [
    { header: 'Code', key: 'id' },
    { header: 'Item', key: 'name' },
    { header: 'Category', key: 'category' },
    { header: 'Quantity', key: 'quantity' },
    { header: 'Unit', key: 'unit' },
    { header: 'Reorder level', key: 'reorderLevel' },
    { header: 'Status', key: 'status' },
  ],
  requests: [
    { header: 'Slip #', key: 'id' },
    { header: 'Requested by', key: 'requester' },
    { header: 'Department', key: 'department' },
    { header: 'Title', key: 'title' },
    { header: 'Items', key: 'items' },
    { header: 'Status', key: 'status' },
    { header: 'Date filed', key: 'createdAt', format: fmtDate },
  ],
  transactions: [
    { header: 'Date', key: 'createdAt', format: fmtDate },
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

const cell = (row, col) => {
  const v = row[col.key];
  if (v === null || v === undefined) return '';
  return col.format ? col.format(v) : v;
};

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

function buildHtml(type, rows, summary) {
  const cols = COLUMNS[type];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;font-size:11px;color:#222}
    h1{font-size:18px;margin:0 0 4px} p{margin:0 0 4px;color:#666}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th{background:#1e40af;color:#fff;text-align:left;padding:6px}
    td{padding:5px 6px;border-bottom:1px solid #ddd}
    tr:nth-child(even) td{background:#f5f7fb}
  </style></head><body>
    <h1>BukSUPPLY – ${TITLES[type]}</h1>
    <p>${esc(summary)}</p>
    <p>Generated ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} · ${rows.length} record(s)</p>
    <table><thead><tr>${cols.map((c) => `<th>${esc(c.header)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map((r) => `<tr>${cols.map((c) => `<td>${esc(cell(r, c))}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>
  </body></html>`;
}

// ---- External API call. Confirm endpoint/options in PDFShift's docs. ----
async function buildPdf(type, rows, summary) {
  if (!process.env.PDFSHIFT_API_KEY) throw new Error('PDF service is not configured.');

  const res = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:
        'Basic ' + Buffer.from(`api:${process.env.PDFSHIFT_API_KEY}`).toString('base64'),
    },
    body: JSON.stringify({ source: buildHtml(type, rows, summary), landscape: true }),
  });

  if (!res.ok) {
    console.error('PDF service error:', res.status, await res.text().catch(() => ''));
    throw new Error(`PDF service failed (${res.status}).`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function buildXlsx(type, rows, summary) {
  const cols = COLUMNS[type];
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BukSUPPLY';
  const ws = wb.addWorksheet(TITLES[type]);

  ws.addRow([`BukSUPPLY – ${TITLES[type]}`]).font = { bold: true, size: 14 };
  ws.addRow([summary]);
  ws.addRow([]);

  const head = ws.addRow(cols.map((c) => c.header));
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
  });

  rows.forEach((r) => ws.addRow(cols.map((c) => cell(r, c))));

  cols.forEach((c, i) => {
    const longest = Math.max(c.header.length, ...rows.map((r) => String(cell(r, c)).length));
    ws.getColumn(i + 1).width = Math.min(Math.max(longest + 2, 10), 50);
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { buildPdf, buildXlsx };
