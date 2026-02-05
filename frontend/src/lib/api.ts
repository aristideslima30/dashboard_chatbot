import axios from 'axios';

const api = axios.create({
  baseURL: typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') : 'http://backend:8000',
});

export default api;
