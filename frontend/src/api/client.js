import axios from 'axios';

// VITE_API_URL is the server address only (e.g. http://localhost:5001). "/api" is added here.
const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api` });

// Same as your old site: the session lives in sessionStorage
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const errMsg = (err) =>
  err.response?.data?.message ||
  (err.response ? 'Something went wrong.' : err.message) ||
  'Cannot reach the server. Please try again.';

export default api;
