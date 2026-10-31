// Self-hosted fallback builders. No external API, no credits, no watermark.
// Install once on the server:  npm install exceljs puppeteer
const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');

// PDF: renders the same HTML the PDF service would receive.
async function buildLocalPdf(html) {
  const browser = await puppeteer.launch({
    headless: true,
    // Needed on most Linux hosts / containers
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// Excel: builds a real .xlsx with a title block, a styled header row and sized columns.
async function buildLocalXlsx({ title, summary, meta, headers, body }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');

  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.addRow([summary]);
  ws.addRow([meta]);
  ws.addRow([]);

  const headerRow = ws.addRow(headers);
  headerRow.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C1A14' } };
  });

  body.forEach((r) => ws.addRow(r));

  // Fit column widths to the content (capped)
  headers.forEach((h, i) => {
    let max = String(h).length;
    body.forEach((r) => {
      max = Math.max(max, String(r[i] ?? '').length);
    });
    ws.getColumn(i + 1).width = Math.min(max + 2, 50);
  });

  // Keep the header row visible while scrolling
  ws.views = [{ state: 'frozen', ySplit: 5 }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { buildLocalPdf, buildLocalXlsx };
