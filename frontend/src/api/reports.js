import api from './client';

// Drop empty values and "All" so the server only gets real filters
const clean = (filters = {}) =>
  Object.fromEntries(Object.entries(filters).filter(([, v]) => v && v !== 'All'));

/**
 * Downloads a report file (PDF or Excel) from the backend server.
 * Files are ONLY downloaded when matching data exists.
 *
 * @param {'stocks' | 'requests' | 'transactions'} type - The report category
 * @param {'pdf' | 'xlsx'} format - Target file format
 * @param {Object} filters - Active UI filters (e.g., category, status, type, from, to)
 */
export async function downloadReport(type, format, filters) {
  const params = clean(filters);

  try {
    const response = await api.get(`/reports/${type}/export`, {
      params: { ...params, format },
      responseType: 'blob', // Crucial: Tells Axios to parse response as binary data
    });

    const stamp = new Date().toISOString().slice(0, 10);
    saveBlob(response.data, `${type}-report-${stamp}.${format}`);
  } catch (err) {
    // Because responseType is 'blob', error responses (like 400 or 502) are returned as Blobs.
    // Convert the error Blob back into text to extract the backend's JSON message.
    if (err.response && err.response.data instanceof Blob) {
      try {
        const errorText = await err.response.data.text();
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          throw new Error(errorJson.message);
        }
      } catch (parseError) {
        // Rethrow if we created an Error with errorJson.message
        if (parseError.message && parseError.message !== 'Unexpected token') {
          throw parseError;
        }
      }
    }
    throw err;
  }
}

/**
 * Helper to trigger browser file download from a Blob
 */
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
 *
 * @param {number} limit - Number of log items to retrieve (default: 15)
 * @returns {Promise<Array>} Export history logs
 */
export async function fetchExportHistory(limit = 15) {
  const res = await api.get('/reports/history', { params: { limit } });
  return res.data;
}
