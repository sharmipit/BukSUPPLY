// Self-hosted fallback builders. No external API, no credits, no watermark.
// Install once on the server:  npm install exceljs puppeteer
const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');

// PDF: renders the same HTML the PDF service would receive, with a running header and footer.
// landscape defaults to true (reports); the issuance slip passes false for portrait.
async function buildLocalPdf(
  html,
  {
    header = '',
    footer = '',
    landscape = true,
    format = 'A4',
    margin = { top: '25mm', bottom: '22mm', left: '10mm', right: '10mm' },
  } = {}
) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    const pdf = await page.pdf({
      format,
      landscape,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: header,
      footerTemplate: footer,
      margin,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

const FONT = 'Times New Roman';
const thin = { style: 'thin', color: { argb: 'FF000000' } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };

// Excel: plain, formal sheet with a title block, bordered table, and verification footer.
async function buildLocalXlsx({ org, subtitle, title, info, code, footerLines, headers, body }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  const last = headers.length;

  const titleLine = (text, size, bold) => {
    const row = ws.addRow([text]);
    if (last > 1) ws.mergeCells(row.number, 1, row.number, last);
    row.getCell(1).font = { name: FONT, size, bold };
    row.getCell(1).alignment = { horizontal: 'center' };
  };
  titleLine(org, 14, true);
  titleLine(subtitle, 11, false);
  titleLine(title, 12, true);
  ws.addRow([]);

  info.forEach((text) => {
    ws.addRow([text]).getCell(1).font = { name: FONT, size: 11 };
  });
  ws.addRow([]);

  const headerRow = ws.addRow(headers);
  headerRow.eachCell((c) => {
    c.font = { name: FONT, bold: true, color: { argb: 'FF000000' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } };
    c.border = BORDER;
  });

  body.forEach((r) => {
    const row = ws.addRow(r);
    row.eachCell({ includeEmpty: true }, (c) => {
      c.font = { name: FONT, size: 11 };
      c.border = BORDER;
    });
  });

  ws.addRow([]);
  footerLines.forEach((text) => {
    ws.addRow([text]).getCell(1).font = { name: FONT, size: 10 };
  });

  // Fit column widths to the table content (capped)
  headers.forEach((h, i) => {
    let max = String(h).length;
    body.forEach((r) => {
      max = Math.max(max, String(r[i] ?? '').length);
    });
    ws.getColumn(i + 1).width = Math.min(max + 2, 50);
  });

  // Keep the table header visible on screen and repeat it on every printed page
  ws.views = [{ state: 'frozen', ySplit: headerRow.number }];
  ws.pageSetup.printTitlesRow = `${headerRow.number}:${headerRow.number}`;

  // Printed header and footer (&& is a literal "&" in Excel header/footer codes)
  const safe = (s) => String(s).replace(/&/g, '&&');
  ws.headerFooter.oddHeader = `&L&"${FONT},Bold"${safe(org)}&R&"${FONT},Bold"${safe(title)}`;
  ws.headerFooter.oddFooter = `&L&"${FONT},Regular"&9Verification code: ${safe(code)}&R&"${FONT},Regular"&9Page &P of &N`;

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Issuance slip as an editable sheet
const FILL_EDIT = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9DB' } }; // editable cells
const FILL_HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } };
const THIN_LINE = { style: 'thin', color: { argb: 'FF000000' } };

// model = { org, subtitle, title, info, items, remarks, signatures, code, footerLines }
async function buildLocalIssuanceXlsx(model) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Issuance Slip', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.8, bottom: 0.8, header: 0.3, footer: 0.3 },
    },
  });
  ws.columns = [{ width: 7 }, { width: 42 }, { width: 14 }, { width: 16 }];

  let r = 1; // current row

  // Title block (merged across A:D)
  const centerLine = (text, size, bold) => {
    const c = ws.getCell(r, 1);
    c.value = text;
    c.font = { name: FONT, size, bold };
    c.alignment = { horizontal: 'center' };
    ws.mergeCells(r, 1, r, 4);
    r++;
  };
  centerLine(model.org, 14, true);
  centerLine(model.subtitle, 11, false);
  centerLine(model.title, 12, true);
  r++;

  // Details: label (A:B) | value (C:D, editable)
  model.info.forEach(([label, value]) => {
    const l = ws.getCell(r, 1);
    l.value = label;
    l.font = { name: FONT, size: 11, bold: true };
    l.border = BORDER;
    const v = ws.getCell(r, 3);
    v.value = value || '';
    v.font = { name: FONT, size: 11 };
    v.fill = FILL_EDIT;
    v.border = BORDER;
    v.alignment = { wrapText: true, vertical: 'top' };
    ws.mergeCells(r, 1, r, 2);
    ws.mergeCells(r, 3, r, 4);
    if (label === 'Purpose') ws.getRow(r).height = 45;
    r++;
  });
  r++;

  // Items table
  ['#', 'Item', 'Quantity', 'Unit'].forEach((h, i) => {
    const c = ws.getCell(r, i + 1);
    c.value = h;
    c.font = { name: FONT, bold: true };
    c.fill = FILL_HEAD;
    c.border = BORDER;
    c.alignment = { horizontal: 'center' };
  });
  r++;

  model.items.forEach((l, i) => {
    [i + 1, l.name, l.qty, l.unit].forEach((val, j) => {
      const c = ws.getCell(r, j + 1);
      c.value = val;
      c.font = { name: FONT, size: 11 };
      c.border = BORDER;
      c.fill = FILL_EDIT;
      c.alignment = { horizontal: j === 1 ? 'left' : 'center', wrapText: true };
    });
    r++;
  });

  // Spare rows for items added by hand
  for (let k = 0; k < 3; k++) {
    for (let j = 1; j <= 4; j++) {
      const c = ws.getCell(r, j);
      c.border = BORDER;
      c.fill = FILL_EDIT;
    }
    r++;
  }
  r++;

  // Remarks
  const rl = ws.getCell(r, 1);
  rl.value = 'Remarks';
  rl.font = { name: FONT, size: 11, bold: true };
  ws.mergeCells(r, 1, r, 4);
  r++;

  const rv = ws.getCell(r, 1);
  rv.value = model.remarks || '';
  rv.font = { name: FONT, size: 11 };
  rv.fill = FILL_EDIT;
  rv.border = BORDER;
  rv.alignment = { wrapText: true, vertical: 'top' };
  ws.mergeCells(r, 1, r + 1, 4);
  r += 3;

  // Signature blocks, two per row (A:B and C:D)
  const sigBlock = (row, c1, sig) => {
    // blank space for the handwritten signature
    ws.mergeCells(row, c1, row, c1 + 1);
    ws.getRow(row).height = 38;

    // printed name (editable)
    const nameCell = ws.getCell(row + 1, c1);
    nameCell.value = sig.name || '';
    nameCell.font = { name: FONT, size: 11, bold: true };
    nameCell.fill = FILL_EDIT;
    nameCell.alignment = { horizontal: 'center' };
    nameCell.border = { top: THIN_LINE };
    ws.mergeCells(row + 1, c1, row + 1, c1 + 1);

    // role label
    const roleCell = ws.getCell(row + 2, c1);
    roleCell.value = sig.role;
    roleCell.font = { name: FONT, size: 10, italic: true };
    roleCell.alignment = { horizontal: 'center' };
    ws.mergeCells(row + 2, c1, row + 2, c1 + 1);
  };

  for (let i = 0; i < model.signatures.length; i += 2) {
    sigBlock(r, 1, model.signatures[i]);
    if (model.signatures[i + 1]) sigBlock(r, 3, model.signatures[i + 1]);
    r += 4; // 3 rows used + 1 spacer
  }

  // Footer lines (verification code, edit note)
  model.footerLines.forEach((text) => {
    const c = ws.getCell(r, 1);
    c.value = text;
    c.font = { name: FONT, size: 10 };
    ws.mergeCells(r, 1, r, 4);
    r++;
  });

  // Printed header and footer
  const safe = (s) => String(s).replace(/&/g, '&&');
  ws.headerFooter.oddHeader = `&L&"${FONT},Bold"${safe(model.org)}&R&"${FONT},Bold"${safe(model.title)}`;
  ws.headerFooter.oddFooter = `&L&"${FONT},Regular"&9Verification code: ${safe(model.code)}&R&"${FONT},Regular"&9Page &P of &N`;

  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { buildLocalPdf, buildLocalXlsx, buildLocalIssuanceXlsx };
