const ExcelJS = require('exceljs');

// Same palette as the website (hex for the PDF, ARGB for Excel)
const THEME = {
  dark: '#2c1a14', // headers, titles
  body: '#594d46', // normal text
  accent: '#8c5839', // brown accent
  border: '#dfd8cc',
  stripe: '#faf7f2',
};
const XL = {
  dark: 'FF2C1A14',
  body: 'FF594D46',
  accent: 'FF8C5839',
  border: 'FFDFD8CC',
  stripe: 'FFFAF7F2',
  white: 'FFFFFFFF',
};

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

const generatedAt = () => new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

function buildHtml(type, rows, summary) {
  const cols = COLUMNS[type];
  return `<!doctype html><html><head><meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body{font-family:'Poppins',Arial,sans-serif;font-size:11px;color:${THEME.body};margin:28px}
    .brand{height:4px;background:${THEME.accent};border-radius:4px;margin-bottom:16px}
    h1{font-size:20px;margin:0 0 4px;color:${THEME.dark}}
    p{margin:0 0 3px;color:${THEME.body};font-size:11px}
    .meta{color:${THEME.accent};font-weight:600}
    table{width:100%;border-collapse:collapse;margin-top:14px}
    th{background:${THEME.dark};color:#fff;text-align:left;padding:8px 10px;font-weight:600;font-size:10.5px}
    td{padding:7px 10px;border-bottom:1px solid ${THEME.border};color:${THEME.dark}}
    tr:nth-child(even) td{background:${THEME.stripe}}
    thead{display:table-header-group}
    tr{page-break-inside:avoid}
  </style></head><body>
    <div class="brand"></div>
    <h1>BukSUPPLY – ${esc(TITLES[type])}</h1>
    <p>${esc(summary)}</p>
    <p class="meta">Generated ${esc(generatedAt())} · ${rows.length} record(s)</p>
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
  const ws = wb.addWorksheet(TITLES[type], {
    views: [{ state: 'frozen', ySplit: 5 }], // keep the header row visible while scrolling
  });

  // Title block (rows 1-4)
  const title = ws.addRow([`BukSUPPLY – ${TITLES[type]}`]);
  title.font = { bold: true, size: 16, color: { argb: XL.dark } };
  title.height = 26;

  ws.addRow([summary]).font = { color: { argb: XL.body } };
  ws.addRow([`Generated ${generatedAt()} · ${rows.length} record(s)`]).font = {
    bold: true,
    color: { argb: XL.accent },
  };
  ws.addRow([]);

  // Header row (row 5)
  const head = ws.addRow(cols.map((c) => c.header));
  head.height = 22;
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: XL.white } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.dark } };
    c.alignment = { vertical: 'middle', horizontal: 'left' };
    c.border = { bottom: { style: 'thin', color: { argb: XL.border } } };
  });

  // Data rows with cream striping and warm borders
  rows.forEach((r, i) => {
    const row = ws.addRow(cols.map((c) => cell(r, c)));
    row.eachCell((c) => {
      c.font = { color: { argb: XL.dark } };
      c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      c.border = { bottom: { style: 'thin', color: { argb: XL.border } } };
      if (i % 2 === 1) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.stripe } };
      }
    });
  });

  // Column widths
  cols.forEach((c, i) => {
    const longest = Math.max(c.header.length, ...rows.map((r) => String(cell(r, c)).length));
    ws.getColumn(i + 1).width = Math.min(Math.max(longest + 2, 10), 50);
  });

  // Filter dropdowns on the header row
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: cols.length } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { buildPdf, buildXlsx };
