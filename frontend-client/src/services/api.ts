import axios from 'axios';

// Dynamically handle local development, custom domain zazaclick.sbs, or production Railway backend
const API_URL = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : window.location.hostname.includes('zazaclick.sbs')
    ? 'https://api.zazaclick.sbs/api'
    : 'https://zaza-click-20-production.up.railway.app/api';

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

export default api;
export { API_URL };
