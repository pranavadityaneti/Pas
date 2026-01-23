import axios from 'axios';

const api = axios.create({
    baseURL: '/api', // Proxied by Vite to localhost:3000
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token interceptor later
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
