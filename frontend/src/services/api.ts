import axios from 'axios';

// Dynamically handle production URL or local development
const API_URL = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api'; // Assumes proxy or same-host deploy

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
