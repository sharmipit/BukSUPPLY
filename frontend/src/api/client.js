import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Same as your old site: the session lives in sessionStorage
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const errMsg = (err) =>
  err.response?.data?.message || 'Cannot reach the server. Please try again.';

export default api;
