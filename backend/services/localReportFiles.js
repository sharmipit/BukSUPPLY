// Self-hosted fallback builders. No external API, no credits, no watermark.
// Install once on the server:  npm install exceljs puppeteer
const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');

// PDF: renders the same HTML the PDF service would receive, with a running header and footer.
async function buildLocalPdf(html, { header = '', footer = '' } = {}) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: header,
      footerTemplate: footer,
      margin: { top: '25mm', bottom: '22mm', left: '10mm', right: '10mm' },
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

module.exports = { buildLocalPdf, buildLocalXlsx };
