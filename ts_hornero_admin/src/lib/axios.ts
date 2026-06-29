import axios from 'axios';

// BFF base URL — NO /api prefix (gotcha #252: BFF routes have no /api prefix,
// only the MS does).
export const api = axios.create({
  baseURL: import.meta.env.VITE_BFF_URL,
  withCredentials: true,
  timeout: 10000,
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
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      // Never retry the refresh endpoint itself — that would cause a deadlock
      // where the queued refresh awaits a refresh that never resolves.
      originalRequest.url !== '/auth/refresh'
    ) {
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
        // Only redirect to /login if the user had an active session.
        // The BFF sets `access_token` (JS-readable) but NOT `session_hint`.
        // Gating on `access_token` presence prevents redirecting anonymous
        // users who hit a public endpoint that happened to return 401.
        const hadSession =
          typeof document !== 'undefined' &&
          document.cookie.includes('access_token');
        if (typeof window !== 'undefined' && hadSession) {
          window.location.href = '/login';
        }
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);
