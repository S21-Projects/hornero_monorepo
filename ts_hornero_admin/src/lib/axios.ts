import axios from 'axios';
import { isApiEnvelope } from '../types/api';
import { IDEMPOTENCY_KEY_HEADER, newIdempotencyKey } from './idempotency';

// BFF base URL — NO /api prefix (gotcha #252: BFF routes have no /api prefix,
// only the MS does).
export const api = axios.create({
  baseURL: import.meta.env.VITE_BFF_URL,
  withCredentials: true,
  timeout: 10000,
});

// N11 fallback: the mutation hooks set a stable per-submission key themselves. Any other business
// POST that did not (a future endpoint, a one-off call) still gets a fresh key so the MS never
// answers 400 IDEMPOTENCY_KEY_REQUERIDA. A key added here protects only this one request object
// (the 401-refresh retry reuses it), not a re-issued submission. /auth/** has its own semantics and
// uploads never reach a business POST in the MS.
const SIN_CLAVE = /^\/(auth|upload)\//;

api.interceptors.request.use((config) => {
  if (
    config.method?.toLowerCase() === 'post' &&
    !SIN_CLAVE.test(config.url ?? '') &&
    !config.headers.has(IDEMPOTENCY_KEY_HEADER)
  ) {
    config.headers.set(IDEMPOTENCY_KEY_HEADER, newIdempotencyKey());
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(null)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => {
    // Unwrap the MS `{status,message,timestamp,data,errors}` envelope so
    // domain code never sees it. `/api/auth/**` responses fail the shape
    // guard (no `status`/`timestamp` fields) and pass through raw.
    if (isApiEnvelope(res.data)) {
      res.data = res.data.data;
    }
    return res;
  },
  async (error) => {
    const originalRequest = error.config;
    // N9: the account was deactivated. Refreshing cannot help (its token family is revoked), so
    // skip the refresh, drop the cookies (best effort) and send the user to /login with the
    // reason. Never navigate when already on /login: session_hint can outlive the session and a
    // redirect to the page we are on would reload-loop.
    if (error.response?.status === 401 && error.response?.data?.message === 'USUARIO_INACTIVO') {
      try {
        await api.post('/auth/logout');
      } catch {
        // best effort: the redirect below still ends the UI session
      }
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login?motivo=cuenta-desactivada';
      }
      return Promise.reject(error);
    }
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
        // access_token is httpOnly (unreadable from JS); use session_hint='1'
        // (httpOnly:false) as the JS-readable "session exists" flag.
        // Gating on session_hint prevents redirecting anonymous visitors
        // who hit a public endpoint that happened to return 401.
        const hadSession =
          typeof document !== 'undefined' &&
          document.cookie.includes('session_hint');
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
