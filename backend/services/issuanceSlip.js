// Issuance slip = the Requisition and Issue Slip (RIS) form, filled from system data.
// Used by reports.js for both the PDF and the Excel versions.
//
// Filled automatically:  entity, office/department, RIS no., date, items (stock no., unit,
//                        description, quantity), purpose, requested-by name and date,
//                        and the report verification code.
// Left blank on purpose: Fund Cluster, Responsibility Center Code, P.R./P.O./I.A.R. numbers,
//                        Supplier, stock-available boxes, issue quantity, unit cost, amount,
//                        and the Approved / Issued / Received signature blocks
//                        (the people in those roles can change, so they sign by hand).

const path = require('path');
const ExcelJS = require('exceljs');

const ENTITY_NAME = 'BUKIDNON STATE UNIVERSITY';
const TEMPLATE_PATH = path.join(__dirname, 'templates', 'RIS-TEMPLATE.xlsx');

// The template has item rows 12..34 (23 rows) per sheet
const FIRST_ITEM_ROW = 12;
const ITEMS_PER_PAGE = 23;

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

// Expected shapes
// slip  = { id, requestedBy, department, purpose, filedAt }
// lines = [{ code?, name, qty, unit }]          (code = stock no., optional)
// meta  = { code, generatedAt, generatedBy }
// fmtDate / fmtStamp are passed in from reports.js so dates look the same everywhere.

// ===================== PDF (HTML) =====================
// The PDF service already prints the running header (university / system / title) and the
// running footer (verification code, generated stamp, "Page x of y") on EVERY page, using
// margins of 25mm top and 22mm bottom, so the usable height is about 250mm.
//
// This builds one full-height "sheet" per page. Each sheet repeats the form fields and
// column headings, and its item table is padded with blank ruled rows so that it always
// fills the page (no big empty area underneath). When there are more items than fit,
// the items flow onto as many pages as needed.
//
// All sizes are in millimetres. The heights add up to about 244mm per page, under the 250mm available.
// The PDF is printed with a 10mm top margin and a 22mm bottom margin (about 265mm usable per page).
// The page title is printed in the body of every page; the slip fields on page 1 only.
// There is no running header and no rule lines.
// Height reserved for the item rows, by kind of page:
const CAP_SINGLE = 137; // only page: title + fields + purpose + signatures
const CAP_FIRST = 196; // first of several: title + fields, no purpose / signatures
const CAP_MIDDLE = 229; // middle page: items only (no slip fields)
const MIN_LAST_PAGE_ROWS = 3; // a signature page never holds just one item
const CAP_LAST = 170; // last of several: purpose + signatures (no slip fields)
const ROW_MIN_MM = 6.4; // one-line row
const LINE_MM = 4.4; // each extra line of wrapped text
const CHARS_PER_LINE = 46; // conservative estimate for the Description column

function textLines(text) {
  const t = String(text ?? '');
  return Math.max(
    1,
    t.split('\n').reduce((n, part) => n + Math.max(1, Math.ceil(part.length / CHARS_PER_LINE)), 0)
  );
}
const rowHeight = (lines) => Math.round((ROW_MIN_MM + (lines - 1) * LINE_MM) * 100) / 100;

// Page 1 carries the slip fields. Only the LAST page carries the purpose and signatures,
// so earlier pages hold more rows.
const capFor = (i, total) =>
  total === 1 ? CAP_SINGLE : i === total - 1 ? CAP_LAST : i === 0 ? CAP_FIRST : CAP_MIDDLE;

function paginate(lines) {
  const items = lines.map((l) => ({ line: l, h: rowHeight(textLines(l.name)) }));
  const sum = (rows) => rows.reduce((t, r) => t + r.h, 0);

  // 1) fill pages greedily at the "items only" size (first page has the slip fields)
  const pages = [];
  let cur = [];
  for (const it of items) {
    const cap = pages.length === 0 ? CAP_FIRST : CAP_MIDDLE;
    if (cur.length && sum(cur) + it.h > cap) {
      pages.push(cur);
      cur = [];
    }
    cur.push(it);
  }
  pages.push(cur);

  // 2) the last page also holds the purpose + signatures: if its rows don't fit there, keep the
  //    earlier page full and move just the last few rows onto a new final page
  const last = pages[pages.length - 1];
  const lastCap = pages.length === 1 ? CAP_SINGLE : CAP_LAST;
  if (sum(last) > lastCap) {
    const tail = [];
    while (last.length > 1 && tail.length < MIN_LAST_PAGE_ROWS) {
      tail.unshift(last.pop());
    }
    pages.push(tail);
  }

  // 3) pad each page with blank ruled rows so it fills its area exactly
  return pages.map((rows, i) => {
    const cap = capFor(i, pages.length);
    const out = rows.slice();
    let left = cap - sum(out);
    while (left >= ROW_MIN_MM) {
      out.push({ line: null, h: ROW_MIN_MM });
      left -= ROW_MIN_MM;
    }
    if (left > 0) out[out.length - 1].h = Math.round((out[out.length - 1].h + left) * 100) / 100;
    return out;
  });
}

function buildIssuanceHtml(
  slip,
  lines,
  { fmtDate, verifyNote, code, orgName = 'Bukidnon State University', systemLine = 'BukSUPPLY' }
) {
  const filed = fmtDate(slip.filedAt);
  const weekday = slip.filedAt
    ? new Date(slip.filedAt).toLocaleDateString('en-PH', {
        weekday: 'long',
        timeZone: 'Asia/Manila',
      })
    : '';
  const filedFull = weekday ? `${filed} (${weekday})` : filed;

  const pages = paginate(lines);

  const itemRow = ({ line, h }) =>
    line
      ? `<tr style="height:${h}mm">
          <td class="c">${esc(line.code || line.id || '')}</td>
          <td class="c">${esc(line.unit || '')}</td>
          <td class="desc">${esc(line.name)}</td>
          <td class="c">${esc(line.qty)}</td>
          ${'<td></td>'.repeat(6)}
        </tr>`
      : `<tr style="height:${h}mm">${'<td></td>'.repeat(10)}</tr>`;

  const sheet = (rows, i) => {
    const isLast = i === pages.length - 1;
    return `
  <section class="sheet">
    <div class="pagehead">
      <h1>REQUISITION AND ISSUE SLIP</h1>
      ${i > 0 ? `<span class="cont">RIS No. ${esc(slip.id)} &ndash; continued</span>` : ''}
    </div>

    ${
      i === 0
        ? `    <table class="fields">
      <colgroup><col style="width:15%"><col style="width:19%"><col style="width:8%"><col style="width:24%"><col style="width:34%"></colgroup>
      <tr>
        <td class="lbl">Entity Name:</td>
        <td colspan="2" class="val">${esc(ENTITY_NAME)}</td>
        <td class="lbl">Fund Cluster:</td>
        <td></td>
      </tr>
      <tr>
        <td class="lbl">Office / Division:</td>
        <td colspan="2" class="val">${esc(slip.department || '')}</td>
        <td class="lbl">Responsibility Center Code:</td>
        <td></td>
      </tr>
      <tr>
        <td class="lbl">P.R. No.:</td><td></td>
        <td class="lbl">Date:</td>
        <td class="lbl">RIS No.:</td>
        <td class="val">${esc(slip.id)}</td>
      </tr>
      <tr>
        <td class="lbl">P.O. No.:</td><td></td>
        <td class="lbl">Date:</td>
        <td class="lbl">Supplier:</td><td></td>
      </tr>
      <tr>
        <td class="lbl">I.A.R. No.:</td><td></td>
        <td class="lbl">Date:</td>
        <td class="lbl">Date of request:</td>
        <td class="val">${esc(filedFull)}</td>
      </tr>
    </table>`
        : ''
    }

    <table class="items">
      <colgroup><col style="width:10%"><col style="width:7%"><col style="width:33%"><col style="width:9%"><col style="width:5%"><col style="width:5%"><col style="width:9%"><col style="width:7%"><col style="width:7%"><col style="width:8%"></colgroup>
      <thead>
        <tr>
          <th colspan="4">Requisition</th>
          <th colspan="2">Stock Available?</th>
          <th colspan="4">Issue</th>
        </tr>
        <tr>
          <th>Stock No.</th>
          <th>Unit</th>
          <th>Description</th>
          <th>Quantity</th>
          <th>Yes</th>
          <th>No</th>
          <th>Quantity</th>
          <th>Main</th>
          <th>Unit Cost</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>${rows.map(itemRow).join('')}</tbody>
    </table>

    ${
      isLast
        ? `<table class="box"><tr><td class="purpose"><b>Purpose:</b> ${esc(slip.purpose || '')}</td></tr></table>

    <table class="sign">
      <colgroup><col style="width:16%"><col style="width:21%"><col style="width:21%"><col style="width:21%"><col style="width:21%"></colgroup>
      <tr>
        <td></td>
        <td class="head">Requested by:</td>
        <td class="head">Approved by:</td>
        <td class="head">Issued by:</td>
        <td class="head">Received by:</td>
      </tr>
      <tr class="tall"><td>Signature:</td><td></td><td></td><td></td><td></td></tr>
      <tr><td>Printed Name:</td><td class="val c">${esc(slip.requestedBy || '')}</td><td></td><td></td><td></td></tr>
      <tr><td>Designation:</td><td></td><td></td><td></td><td></td></tr>
      <tr><td>Date:</td><td>${esc(filed)}</td><td><b>DATE:</b></td><td><b>DATE:</b></td><td><b>DATE:</b></td></tr>
    </table>`
        : ''
    }

    <div class="end">${
      i < pages.length - 1
        ? `*** Continued on next page (page ${i + 1} of ${pages.length}) ***`
        : pages.length > 1
          ? `*** End of slip (page ${i + 1} of ${pages.length}) ***`
          : '*** End of slip ***'
    }</div>
  </section>`;
  };

  return `<!doctype html><html><head><meta charset="utf-8">
  <style>
    @page { size: A4 portrait; }  /* A4 */
    body{font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-size:10.5px;color:#000;margin:0}
    .sheet{break-after:page;page-break-after:always;box-sizing:border-box;padding:0 1mm}
    .sheet:last-child{break-after:auto;page-break-after:auto}
    .pagehead{position:relative;height:9mm}
    .cont{position:absolute;right:0;bottom:0;font-size:10px;font-style:italic;line-height:1}
    h1{font-family:Arial,Helvetica,sans-serif;font-size:15px;text-align:center;margin:0;height:6mm;line-height:6mm}
    table{border-collapse:collapse;width:100%;table-layout:fixed}
    td,th{border:1px solid #000;padding:0 5px;vertical-align:middle;line-height:1.25;overflow:hidden}
    .fields td{height:6.4mm}
    .lbl{white-space:nowrap}
    .c{text-align:center}
    .val{font-weight:bold}
    .items th{font-weight:bold;text-align:center;height:6mm}
    .items td.desc{padding-top:1mm;padding-bottom:1mm;word-wrap:break-word}
    thead{display:table-header-group}
    tr{page-break-inside:avoid}
    .box,.sign,.items{margin-top:-1px}
    .purpose{height:15mm;vertical-align:top;padding-top:1.5mm}
    .sign td{height:7mm}
    .sign tr.tall td{height:12mm}
    .sign .head{text-align:left}
    .end{text-align:center;margin-top:2.5mm;font-size:10px;height:4mm}
  </style></head><body>
    ${pages.map(sheet).join('')}
  </body></html>`;
}

// ===================== Excel (fills the RIS template) =====================
// Keeps the exact look of the official form by loading it and writing values into its cells.
async function buildIssuanceXlsxFromTemplate(
  slip,
  lines,
  { fmtDate, fmtStamp, verifyNote, code, generatedAt, systemLine = 'BukSUPPLY' }
) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);

  const base = wb.getWorksheet('Sheet1') || wb.worksheets[0];
  // Drop the empty extra sheets that come with the sample file
  wb.worksheets.filter((w) => w.id !== base.id).forEach((w) => wb.removeWorksheet(w.id));

  const pageCount = Math.max(1, Math.ceil(lines.length / ITEMS_PER_PAGE));
  const sheets = [base];
  for (let p = 1; p < pageCount; p++) {
    // More than 23 items: add a continuation sheet with the same layout
    const copy = wb.addWorksheet(`Sheet${p + 1}`);
    const clone = JSON.parse(JSON.stringify(base.model));
    const merges = clone.merges || [];
    clone.merges = []; // exceljs drops merges when a model is assigned, so re-apply them below
    copy.model = Object.assign({}, clone, { name: `Sheet${p + 1}` });
    merges.forEach((range) => copy.mergeCells(range));
    sheets.push(copy);
  }
  if (pageCount > 1) {
    sheets.forEach((ws, i) => {
      ws.name = `Page ${i + 1}`;
    });
  }

  const filed = fmtDate(slip.filedAt);
  const set = (ws, addr, value) => {
    ws.getCell(addr).value = value;
  };

  sheets.forEach((ws, p) => {
    // Continuation sheets: hide the title and slip-fields block (rows 1-9); the column headings stay
    if (p > 0) for (let r = 1; r <= 9; r++) ws.getRow(r).hidden = true;

    // ----- header block -----
    set(ws, 'B6', slip.department || ''); // Division / Office (merged B6:H7)
    set(ws, 'J7', String(slip.id)); // RIS No.  (merged J7:M7)
    ws.getCell('J7').alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getCell('B6').alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    // ----- item rows -----
    const chunk = lines.slice(p * ITEMS_PER_PAGE, (p + 1) * ITEMS_PER_PAGE);
    chunk.forEach((l, i) => {
      const r = FIRST_ITEM_ROW + i;
      set(ws, `A${r}`, l.code || '');
      set(ws, `B${r}`, l.unit || '');
      set(ws, `C${r}`, l.name); // merged C:F
      set(ws, `G${r}`, Number.isFinite(Number(l.qty)) ? Number(l.qty) : l.qty);
      ws.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(`B${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(`G${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(`C${r}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      // Long names: make the row tall enough to show every line (about 38 characters per line)
      const need = Math.ceil(String(l.name ?? '').length / 38);
      if (need > 2) ws.getRow(r).height = Math.max(ws.getRow(r).height || 0, need * 14 + 4);
    });

    const isLast = p === pageCount - 1;
    if (isLast) {
      // ----- purpose (merged B35:M36) -----
      set(ws, 'B35', slip.purpose || '');
      ws.getCell('B35').alignment = { horizontal: 'left', vertical: 'top', wrapText: true };

      // ----- requested by: name and date only; approver / issuer / receiver stay blank -----
      set(ws, 'B40', slip.requestedBy || ''); // merged B40:D40
      set(ws, 'B42', filed); // merged B42:D42
      ws.getCell('B40').alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell('B42').alignment = { horizontal: 'left', vertical: 'middle' };
    } else {
      // Continuation sheet: purpose and signatures appear once, on the last sheet only
      for (let r = 35; r <= 42; r++) {
        for (let c = 1; c <= 13; c++) {
          const cell = ws.getCell(r, c);
          const isSlave = cell.isMerged && cell.master && cell.master.address !== cell.address;
          if (!isSlave) cell.value = null; // merged cells keep their value in the top-left cell
          cell.border = {};
          cell.fill = { type: 'pattern', pattern: 'none' };
        }
      }
      set(ws, 'B35', '*** Continued on the next page ***');
      ws.getCell('B35').font = { name: 'Arial Narrow', size: 11, italic: true };
      ws.getCell('B35').alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // ----- report verification (required) -----
    const lineAt = (row, text, bold) => {
      ws.mergeCells(`A${row}:M${row}`);
      const c = ws.getCell(`A${row}`);
      c.value = text;
      c.font = { name: 'Arial Narrow', size: 10, bold: !!bold };
      c.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    };
    lineAt(44, `Verification code: ${code}`, true);
    lineAt(45, verifyNote, false);
    lineAt(
      46,
      p === pageCount - 1 ? '*** End of slip ***' : `*** Continued on page ${p + 2} ***`,
      false
    );
    ws.getRow(45).height = 26;

    // ----- print setup: A4 portrait, one sheet per page, proper header and footer -----
    const hf = (t) => String(t).replace(/&/g, '&&'); // "&" is a control character in Excel headers
    ws.pageSetup.paperSize = 9;
    ws.pageSetup.orientation = 'portrait';
    ws.pageSetup.fitToPage = true;
    ws.pageSetup.fitToWidth = 1;
    ws.pageSetup.fitToHeight = 1;
    ws.pageSetup.horizontalCentered = true;
    ws.pageSetup.margins = {
      left: 0.31,
      right: 0.31,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3,
    };
    ws.pageSetup.printArea = 'A1:M46';
    ws.headerFooter = {
      // sheet 1 already has the title in row 1; continuation sheets get it as the page header
      oddHeader:
        p === 0
          ? ''
          : `&C&"Arial,Bold"&11REQUISITION AND ISSUE SLIP&R&"Arial,Italic"&9RIS No. ${hf(slip.id)} - continued`,
      oddFooter:
        `&L&"Arial"&8Verification code: ${hf(code)}` +
        (generatedAt && fmtStamp ? `&C&"Arial"&8Generated ${hf(fmtStamp(generatedAt))}` : '') +
        `&R&"Arial"&8Page &P of &N`,
    };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { buildIssuanceHtml, buildIssuanceXlsxFromTemplate };
