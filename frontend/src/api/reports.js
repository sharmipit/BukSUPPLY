import api from './client';

// Drop empty values and "All" so the server only gets real filters
const clean = (filters = {}) =>
  Object.fromEntries(Object.entries(filters).filter(([, v]) => v && v !== 'All'));

// With responseType 'blob', error bodies also arrive as Blobs, so read the JSON message out
async function throwBlobError(err) {
  if (err.response && err.response.data instanceof Blob) {
    let message = '';
    try {
      message = JSON.parse(await err.response.data.text()).message || '';
    } catch {
      // body wasn't JSON, fall through to the original error
    }
    if (message) throw new Error(message);
  }
  throw err;
}

/**
 * Downloads a report file (PDF or Excel) from the backend server.
 */
export async function downloadReport(type, format, filters) {
  const params = clean(filters);

  try {
    const response = await api.get(`/reports/${type}/export`, {
      params: { ...params, format },
      responseType: 'blob',
    });

    const stamp = new Date().toISOString().slice(0, 10);
    saveBlob(response.data, `${type}-report-${stamp}.${format}`);
  } catch (err) {
    await throwBlobError(err);
  }
}

/**
 * Downloads the issuance slip for one requisition (same pipeline as the reports).
 * format: 'pdf' (default) or 'xlsx' (editable Excel).
 */
async function downloadSlip(id, format) {
  try {
    const response = await api.get(`/reports/issuance/${encodeURIComponent(id)}/export`, {
      params: { format },
      responseType: 'blob',
    });
    saveBlob(response.data, `issuance-slip-${id}.${format}`);
  } catch (err) {
    await throwBlobError(err);
  }
}

export const downloadIssuanceSlip = (id) => downloadSlip(id, 'pdf');
export const downloadIssuanceSlipExcel = (id) => downloadSlip(id, 'xlsx');

/**
 * Fetches the report rows as JSON (used for the preview before downloading).
 */
export async function fetchReportRows(type, filters) {
  const res = await api.get(`/reports/${type}`, { params: clean(filters) });
  return res.data;
}

function saveBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Fetches recent export logs from the backend.
 */
export async function fetchExportHistory(limit = 15) {
  const res = await api.get('/reports/history', { params: { limit } });
  return res.data;
}

export async function verifyReport(code) {
  const res = await api.get(`/reports/verify/${encodeURIComponent(String(code).trim())}`);
  return res.data;
}
