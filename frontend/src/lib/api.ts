import axios from 'axios';

const baseURL = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') : 'http://backend:8000';
if (typeof window !== 'undefined') {
  console.log('API Base URL:', baseURL);
}
const api = axios.create({
  baseURL,
});

export default api;
