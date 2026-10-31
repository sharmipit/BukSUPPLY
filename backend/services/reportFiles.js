const settings = require('./settings');
const { buildLocalPdf, buildLocalXlsx } = require('./localReportFiles');

// After an external service fails (limit reached, bad key, outage), skip it for this long
// and use the self-hosted builder instead. After the pause, the external service is tried
// again, so it switches back on its own once credits are restored.
const COOLDOWN_MS = 15 * 60 * 1000;
const pausedUntil = { pdf: 0, xlsx: 0 };

// Same palette as the website
const THEME = {
  dark: '#2c1a14', // headers, titles
  body: '#594d46', // normal text
  accent: '#8c5839', // brown accent
  border: '#dfd8cc',
  stripe: '#faf7f2',
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

// An error whose message is safe to show to the user
const userError = (message) => {
  const e = new Error(message);
  e.userFacing = true;
  return e;
};

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
async function buildPdfExternal(type, rows, summary) {
  const s = settings.get();
  if (!s.pdfshiftApiKey) throw new Error('PDF service is not configured.');

  const res = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`api:${s.pdfshiftApiKey}`).toString('base64'),
    },
    body: JSON.stringify({ source: buildHtml(type, rows, summary), landscape: true }),
  });

  if (!res.ok) {
    console.error('PDF service error:', res.status, await res.text().catch(() => ''));
    throw new Error(`PDF service failed (${res.status}).`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// Excel is built from a plain HTML table. Converters read tables, so skip fonts, stripes and CSS.
function buildXlsxHtml(type, rows, summary) {
  const cols = COLUMNS[type];
  const span = cols.length;
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
  <table>
    <tr><td colspan="${span}"><b>BukSUPPLY – ${esc(TITLES[type])}</b></td></tr>
    <tr><td colspan="${span}">${esc(summary)}</td></tr>
    <tr><td colspan="${span}">Generated ${esc(generatedAt())} · ${rows.length} record(s)</td></tr>
    <tr>${cols.map((c) => `<th>${esc(c.header)}</th>`).join('')}</tr>
    ${rows
      .map((r) => `<tr>${cols.map((c) => `<td>${esc(cell(r, c))}</td>`).join('')}</tr>`)
      .join('')}
  </table></body></html>`;
}

// ---- External API call. Confirm endpoint/options in Nutrient's docs. ----
async function buildXlsxExternal(type, rows, summary) {
  const s = settings.get();
  if (!s.nutrientApiKey) throw new Error('Excel service is not configured.');

  const form = new FormData(); // global in Node 18+, same as fetch
  form.append(
    'document',
    new Blob([buildXlsxHtml(type, rows, summary)], { type: 'text/html' }),
    'report.html'
  );
  form.append(
    'instructions',
    JSON.stringify({ parts: [{ html: 'document' }], output: { type: 'xlsx' } })
  );

  // Don't set Content-Type yourself; fetch adds the multipart boundary
  const res = await fetch('https://api.nutrient.io/build', {
    method: 'POST',
    headers: { Authorization: `Bearer ${s.nutrientApiKey}` },
    body: form,
  });

  if (!res.ok) {
    console.error('Excel service error:', res.status, await res.text().catch(() => ''));
    throw new Error(`Excel service failed (${res.status}).`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ---- External first, self-hosted as the fallback ----
const tableData = (type, rows) => ({
  headers: COLUMNS[type].map((c) => c.header),
  body: rows.map((r) => COLUMNS[type].map((c) => cell(r, c))),
});

async function withFallback(kind, external, local) {
  if (Date.now() >= pausedUntil[kind]) {
    try {
      const file = await external();
      console.log(`[reports] ${kind}: built by the external service`);
      return file;
    } catch (err) {
      pausedUntil[kind] = Date.now() + COOLDOWN_MS;
      console.error(
        `External ${kind} failed (${err.message}). Using the self-hosted builder for the next ${COOLDOWN_MS / 60000} minutes.`
      );
    }
  }
  console.log(`[reports] ${kind}: built by the self-hosted builder`);
  return local();
}

async function buildPdf(type, rows, summary) {
  // The admin switch still turns downloads off completely
  if (!settings.get().pdfshiftEnabled) {
    throw userError('PDF downloads are turned off by the administrator.');
  }
  return withFallback(
    'pdf',
    () => buildPdfExternal(type, rows, summary),
    () => buildLocalPdf(buildHtml(type, rows, summary))
  );
}

async function buildXlsx(type, rows, summary) {
  if (!settings.get().nutrientEnabled) {
    throw userError('Excel downloads are turned off by the administrator.');
  }
  return withFallback(
    'xlsx',
    () => buildXlsxExternal(type, rows, summary),
    () =>
      buildLocalXlsx({
        title: `BukSUPPLY – ${TITLES[type]}`,
        summary,
        meta: `Generated ${generatedAt()} · ${rows.length} record(s)`,
        ...tableData(type, rows),
      })
  );
}

module.exports = { buildPdf, buildXlsx };
