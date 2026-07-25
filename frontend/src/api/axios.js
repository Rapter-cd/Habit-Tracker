import axios from 'axios';

/**
 * Axios instance pre-configured with the base URL from .env.
 * The auth interceptor automatically attaches the JWT from localStorage
 * to every request as "Authorization: Bearer <token>".
 *
 * All API calls go through this instance so auth handling is centralised.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — inject Bearer token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('streakup_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('streakup_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
