import axios from 'axios';

// Dynamically handle local development or official production API zazaclick.sbs
const API_URL = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : 'https://api.zazaclick.sbs/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto-inject Authorization header for all requests if token exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('saas_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Auto-redirect to login on expired JWT (401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login') && !error.config?.url?.includes('/auth/me')) {
      localStorage.removeItem('saas_auth_token');
      localStorage.removeItem('saas_user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_URL };
