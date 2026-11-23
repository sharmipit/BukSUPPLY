import axios from 'axios';

// VITE_API_URL is the server address only (e.g. http://localhost:5001). "/api" is added here.
const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api` });

// Attach authorization bearer token from sessionStorage
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Event fired when the server says the signed-in account was deactivated.
export const DEACTIVATED_EVENT = 'buksupply:account-deactivated';

// True when a failed request says the account is deactivated.
// The server answers 401/403 with code "ACCOUNT_DEACTIVATED" (same code the sign-in uses).
const isDeactivation = (err) => {
  const status = err.response?.status;
  if (status !== 401 && status !== 403) return false;
  const data = err.response?.data || {};
  return data.code === 'ACCOUNT_DEACTIVATED' || /deactivat/i.test(String(data.message || ''));
};

// Set after the person deactivates their OWN account (Profile page), so no pop-up appears
// during the short moment before they are logged out.
let selfDeactivated = false;

api.interceptors.response.use(
  (response) => {
    if (/\/user\/deactivate$/.test(response.config?.url || '')) selfDeactivated = true;
    return response;
  },
  (err) => {
    const url = err.config?.url || '';
    const wasSignedIn = Boolean(err.config?.headers?.Authorization);

    if (
      wasSignedIn && // only requests sent with a token, never sign-in / sign-up attempts
      !selfDeactivated &&
      !url.startsWith('/auth/') &&
      isDeactivation(err)
    ) {
      window.dispatchEvent(new CustomEvent(DEACTIVATED_EVENT, { detail: err.response.data }));
    }
    return Promise.reject(err);
  }
);

export const errMsg = (err) =>
  err.response?.data?.message ||
  (err.response ? 'Something went wrong.' : err.message) ||
  'Cannot reach the server. Please try again.';

export default api;