import { randomUUID } from 'node:crypto';

/** Minimal HTTP client with a per-actor cookie jar (BFF auth rides on httpOnly cookies). */

export const BFF_URL = (process.env.E2E_BFF_URL ?? 'http://localhost:3001').replace(/\/$/, '');

export interface Res<T = any> {
  status: number;
  /** Full parsed JSON body (`{status,message,data,errors}` envelope for success). */
  body: any;
  /** Envelope payload (`body.data`) when present. */
  data: T;
  setCookies: string[];
  /** Response headers, lower-cased names. */
  headers: Record<string, string>;
}

export type CookieJar = Record<string, string>;

export class Actor {
  constructor(
    public readonly label: string,
    public jar: CookieJar = {},
    private readonly baseUrl: string = BFF_URL,
  ) {}

  private cookieHeader(): string {
    return Object.entries(this.jar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  private absorb(setCookies: string[]): void {
    for (const raw of setCookies) {
      const [pair, ...attrs] = raw.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const expired = attrs.some((a) => /^\s*expires=/i.test(a) && new Date(a.split('=')[1]).getTime() < Date.now());
      if (!value || expired) delete this.jar[name];
      else this.jar[name] = value;
    }
  }

  async request<T = any>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<Res<T>> {
    const headers: Record<string, string> = { ...extraHeaders };
    const cookie = this.cookieHeader();
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookies = res.headers.getSetCookie();
    this.absorb(setCookies);
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return {
      status: res.status,
      body: parsed,
      data: parsed?.data,
      setCookies,
      headers: Object.fromEntries(res.headers.entries()),
    };
  }

  get = <T = any>(path: string) => this.request<T>('GET', path);
  /**
   * Business POSTs are idempotent-by-key (N11): a fresh `Idempotency-Key` is added unless the test
   * passes one (`{ key }`) or opts out (`{ key: null }`, to assert the 400). `/auth/**` never gets one.
   */
  post = <T = any>(path: string, body?: unknown, opts: { key?: string | null } = {}) => {
    const headers: Record<string, string> = {};
    if (opts.key !== null && !path.startsWith('/auth/')) {
      headers['idempotency-key'] = opts.key ?? randomUUID();
    }
    return this.request<T>('POST', path, body, headers);
  };
  patch = <T = any>(path: string, body?: unknown) => this.request<T>('PATCH', path, body);
  del = <T = any>(path: string) => this.request<T>('DELETE', path);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Logs in; on 429 (BFF auth rate limit, 5/min per IP) waits for the window to reset and retries. */
export async function login(email: string, password: string, label = email): Promise<Actor> {
  const actor = new Actor(label);
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await actor.post('/auth/login', { email, password });
    if (res.status === 429) {
      await sleep(61_000);
      continue;
    }
    if (res.status !== 201 && res.status !== 200) {
      throw new Error(`login ${email} failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return actor;
  }
  throw new Error(`login ${email} still rate limited after retries`);
}

/**
 * Runs `call`, and when the BFF auth throttle answers 429 (login 5/min, register 3/min per IP;
 * the window carries over between back-to-back runs) waits for it to reset and retries.
 */
export async function retryOn429(call: () => Promise<Res>): Promise<Res> {
  let res!: Res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await call();
    if (res.status !== 429) return res;
    await sleep(61_000);
  }
  return res;
}

export interface RegistroDonante {
  email: string;
  nombre?: string;
  password?: string;
}

/** Registers a donante through the BFF. Every e2e registration goes through here (429-safe). */
export function registerDonante(actor: Actor, datos: RegistroDonante): Promise<Res> {
  return retryOn429(() =>
    actor.post('/auth/register', {
      nombre: datos.nombre ?? 'E2E Donante',
      email: datos.email,
      password: datos.password ?? 'cafetera azul canta fuerte',
      tipo: 'DONANTE',
    }),
  );
}
