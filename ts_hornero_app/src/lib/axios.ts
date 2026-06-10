import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BFF_URL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(null)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
          .then(() => api(originalRequest))
          .catch((e) => Promise.reject(e));
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(originalRequest);
      } catch (e) {
        processQueue(e);
        // Only redirect to login if the page requires authentication.
        // Checking for a session cookie/flag avoids redirecting anonymous users
        // who hit public endpoints that happened to return 401 (e.g. backend
        // not yet reachable, transient error, etc.).
        const hadSession = typeof document !== 'undefined' &&
          (document.cookie.includes('access_token') || document.cookie.includes('refresh_token'));
        if (typeof window !== 'undefined' && hadSession) {
          window.location.href = '/login';
        }
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
