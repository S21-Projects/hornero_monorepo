import { AsyncLocalStorage } from 'node:async_hooks';
import axios, { type AxiosInstance } from 'axios';
import type { NextFunction, Request, Response } from 'express';

/**
 * N10: the MS records the client address of every audited event, but it only ever sees the BFF's
 * socket. The BFF therefore forwards the visitor's address on every call to the MS in this header.
 * The value is derived here (never copied from an incoming `X-Client-IP`), and the MS trusts it
 * because it is only reachable from the BFF (compose publishes it on 127.0.0.1 only).
 */
export const CLIENT_IP_HEADER = 'X-Client-IP';

/**
 * N11: mandatory idempotency on business POSTs. The BFF is a transparent carrier: it forwards the
 * client's key to the MS (which owns the semantics) and relays the MS's replay marker back.
 */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IDEMPOTENT_REPLAYED_HEADER = 'Idempotent-Replayed';

const IP_LITERAL = /^[0-9a-fA-F:.]{2,45}$/;
// Shape check only (the MS validates that it is a UUID): keeps anything header-unsafe out.
const KEY_SHAPE = /^[A-Za-z0-9-]{1,64}$/;

interface RequestContext {
  ip?: string;
  idempotencyKey?: string;
  res?: Pick<Response, 'headersSent' | 'setHeader'>;
}

const store = new AsyncLocalStorage<RequestContext>();

/**
 * Real client IP: `cf-connecting-ip` behind the Cloudflare Tunnel (same trust assumption as
 * `ClientIpThrottlerGuard`), else the socket address. Anything that is not an IP literal is
 * dropped so a forged header cannot carry text into the audit log.
 */
export function resolveClientIp(req: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}): string | undefined {
  const header = req.headers?.['cf-connecting-ip'];
  const fromHeader = (Array.isArray(header) ? header[0] : header)?.trim();
  for (const candidate of [fromHeader, req.ip?.trim()]) {
    if (candidate && IP_LITERAL.test(candidate)) return candidate;
  }
  return undefined;
}

function resolveIdempotencyKey(req: {
  headers?: Record<string, string | string[] | undefined>;
}): string | undefined {
  const header = req.headers?.['idempotency-key'];
  // A repeated header arrives as an array: ambiguous, so no key is forwarded and the MS answers 400.
  const value = typeof header === 'string' ? header.trim() : undefined;
  return value && KEY_SHAPE.test(value) ? value : undefined;
}

/**
 * Express middleware: keeps the client IP, the Idempotency-Key and the response object available
 * to outbound calls for this request.
 */
export function clientIpMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  store.run(
    {
      ip: resolveClientIp(req),
      idempotencyKey: resolveIdempotencyKey(req),
      res,
    },
    next,
  );
}

function relayReplayMarker(headers: unknown): void {
  const getter = (headers as { get?: (name: string) => unknown } | undefined)
    ?.get;
  const replayed = getter?.call(headers, IDEMPOTENT_REPLAYED_HEADER);
  const res = store.getStore()?.res;
  if (replayed === 'true' && res && !res.headersSent) {
    res.setHeader(IDEMPOTENT_REPLAYED_HEADER, 'true');
  }
}

const installed = new WeakSet<AxiosInstance>();

/**
 * Adds the header to every request to the MS made while serving an HTTP request. Installed once on
 * the shared axios instance, so no service builds the header itself. Calls to any other host get
 * nothing.
 */
export function installClientIpForwarding(
  instance: AxiosInstance = axios,
): void {
  if (installed.has(instance)) return;
  installed.add(instance);
  instance.interceptors.request.use((config) => {
    const ip = store.getStore()?.ip;
    const ms = process.env.JAVA_MS_URL;
    const target = `${config.baseURL ?? ''}${config.url ?? ''}`;
    const toMs = !!ms && target.startsWith(ms);
    if (ip && toMs) {
      config.headers.set(CLIENT_IP_HEADER, ip);
    }
    const key = store.getStore()?.idempotencyKey;
    if (key && toMs && config.method?.toLowerCase() === 'post') {
      config.headers.set(IDEMPOTENCY_KEY_HEADER, key);
    }
    return config;
  });
  instance.interceptors.response.use(
    (response) => {
      relayReplayMarker(response.headers);
      return response;
    },
    (error) => {
      relayReplayMarker(error?.response?.headers);
      return Promise.reject(error);
    },
  );
}
