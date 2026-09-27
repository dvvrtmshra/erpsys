import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.response.use(
  res => res,
  err => Promise.reject(err)
);

export default api;
