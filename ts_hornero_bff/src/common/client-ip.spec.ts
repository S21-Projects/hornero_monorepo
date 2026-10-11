import axios from 'axios';
import {
  CLIENT_IP_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENT_REPLAYED_HEADER,
  clientIpMiddleware,
  installClientIpForwarding,
  resolveClientIp,
} from './client-ip';

describe('resolveClientIp', () => {
  it('prefers cf-connecting-ip over the socket address', () => {
    expect(
      resolveClientIp({
        headers: { 'cf-connecting-ip': '203.0.113.7' },
        ip: '172.18.0.1',
      }),
    ).toBe('203.0.113.7');
  });

  it('falls back to req.ip and ignores a blank header', () => {
    expect(resolveClientIp({ headers: {}, ip: '172.18.0.1' })).toBe(
      '172.18.0.1',
    );
    expect(
      resolveClientIp({
        headers: { 'cf-connecting-ip': '  ' },
        ip: '172.18.0.1',
      }),
    ).toBe('172.18.0.1');
  });

  it('takes the first value of a repeated header', () => {
    expect(
      resolveClientIp({
        headers: { 'cf-connecting-ip': ['203.0.113.7', '198.51.100.1'] },
        ip: 'x',
      }),
    ).toBe('203.0.113.7');
  });
});

describe('client IP forwarding to the MS', () => {
  const MS = 'http://ms.test:8081';
  const original = process.env.JAVA_MS_URL;
  let seen: Record<string, unknown>;

  const instance = () => {
    const ax = axios.create({
      adapter: async (config) => {
        seen = { ...config.headers.toJSON() };
        return {
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      },
    });
    installClientIpForwarding(ax);
    return ax;
  };

  beforeEach(() => {
    process.env.JAVA_MS_URL = MS;
    seen = {};
  });
  afterAll(() => {
    process.env.JAVA_MS_URL = original;
  });

  const withinRequest = (
    headers: Record<string, string>,
    fn: () => Promise<unknown>,
  ) =>
    new Promise<void>((resolve, reject) => {
      clientIpMiddleware(
        { headers, ip: '172.18.0.1' } as any,
        {} as any,
        () => {
          fn().then(() => resolve(), reject);
        },
      );
    });

  it('adds X-Client-IP, derived server-side, to calls made while serving a request', async () => {
    const ax = instance();
    await withinRequest({ 'cf-connecting-ip': '203.0.113.7' }, () =>
      ax.post(`${MS}/api/auth/login`, {}),
    );
    expect(seen[CLIENT_IP_HEADER]).toBe('203.0.113.7');
  });

  it('survives awaits between the middleware and the outbound call', async () => {
    const ax = instance();
    await withinRequest({}, async () => {
      await new Promise((r) => setTimeout(r, 5));
      await ax.get(`${MS}/api/usuarios`);
    });
    expect(seen[CLIENT_IP_HEADER]).toBe('172.18.0.1');
  });

  it('does not leak the header to other hosts', async () => {
    const ax = instance();
    await withinRequest({ 'cf-connecting-ip': '203.0.113.7' }, () =>
      ax.get('http://other.example/resource'),
    );
    expect(seen[CLIENT_IP_HEADER]).toBeUndefined();
  });

  it('sends nothing outside a request context (startup, jobs)', async () => {
    const ax = instance();
    await ax.get(`${MS}/api/usuarios`);
    expect(seen[CLIENT_IP_HEADER]).toBeUndefined();
  });

  it('never forwards an IP-shaped value that a client could use for injection', async () => {
    const ax = instance();
    await withinRequest({ 'cf-connecting-ip': '1.2.3.4\r\nX-Evil: 1' }, () =>
      ax.get(`${MS}/api/usuarios`),
    );
    expect(seen[CLIENT_IP_HEADER]).toBe('172.18.0.1');
  });

  it('is idempotent per instance', async () => {
    const ax = instance();
    installClientIpForwarding(ax);
    await withinRequest({ 'cf-connecting-ip': '203.0.113.7' }, () =>
      ax.get(`${MS}/api/usuarios`),
    );
    expect(seen[CLIENT_IP_HEADER]).toBe('203.0.113.7');
  });
});

describe('Idempotency-Key forwarding to the MS (N11)', () => {
  const MS = 'http://ms.test:8081';
  const KEY = '3f2b8c1e-5d7a-4c9e-8b21-0a1f2e3d4c5b';
  const original = process.env.JAVA_MS_URL;
  let seen: Record<string, unknown>;
  let respond: { status: number; headers: Record<string, string> };

  const instance = () => {
    const ax = axios.create({
      adapter: async (config) => {
        seen = { ...config.headers.toJSON() };
        const response = {
          data: {},
          status: respond.status,
          statusText: '',
          headers: respond.headers,
          config,
        };
        if (respond.status >= 400) {
          throw new axios.AxiosError(
            'failed',
            'ERR_BAD_REQUEST',
            config,
            null,
            response as any,
          );
        }
        return response;
      },
    });
    installClientIpForwarding(ax);
    return ax;
  };

  beforeEach(() => {
    process.env.JAVA_MS_URL = MS;
    seen = {};
    respond = { status: 201, headers: {} };
  });
  afterAll(() => {
    process.env.JAVA_MS_URL = original;
  });

  const withinRequest = (
    headers: Record<string, string>,
    fn: () => Promise<unknown>,
    res: any = { headersSent: false, setHeader: jest.fn() },
  ) =>
    new Promise<void>((resolve, reject) => {
      clientIpMiddleware({ headers, ip: '172.18.0.1' } as any, res, () => {
        fn().then(() => resolve(), reject);
      });
    });

  it('forwards the incoming key on POSTs to the MS', async () => {
    const ax = instance();
    await withinRequest({ 'idempotency-key': KEY }, () =>
      ax.post(`${MS}/api/donaciones`, {}),
    );
    expect(seen[IDEMPOTENCY_KEY_HEADER]).toBe(KEY);
  });

  it('does not forward it on GETs or to other hosts', async () => {
    const ax = instance();
    await withinRequest({ 'idempotency-key': KEY }, () =>
      ax.get(`${MS}/api/donaciones`),
    );
    expect(seen[IDEMPOTENCY_KEY_HEADER]).toBeUndefined();
    await withinRequest({ 'idempotency-key': KEY }, () =>
      ax.post('http://other.example/x', {}),
    );
    expect(seen[IDEMPOTENCY_KEY_HEADER]).toBeUndefined();
  });

  it('sends nothing when the client sent no key, and drops values that are not key-shaped', async () => {
    const ax = instance();
    await withinRequest({}, () => ax.post(`${MS}/api/donaciones`, {}));
    expect(seen[IDEMPOTENCY_KEY_HEADER]).toBeUndefined();
    await withinRequest({ 'idempotency-key': 'a b\r\nX-Evil: 1' }, () =>
      ax.post(`${MS}/api/donaciones`, {}),
    );
    expect(seen[IDEMPOTENCY_KEY_HEADER]).toBeUndefined();
  });

  it('relays Idempotent-Replayed from a replayed success to the client response', async () => {
    const ax = instance();
    const res = { headersSent: false, setHeader: jest.fn() };
    respond = { status: 201, headers: { 'idempotent-replayed': 'true' } };
    await withinRequest(
      { 'idempotency-key': KEY },
      () => ax.post(`${MS}/api/donaciones`, {}),
      res,
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      IDEMPOTENT_REPLAYED_HEADER,
      'true',
    );
  });

  it('relays Idempotent-Replayed from a replayed error too', async () => {
    const ax = instance();
    const res = { headersSent: false, setHeader: jest.fn() };
    respond = { status: 400, headers: { 'idempotent-replayed': 'true' } };
    await withinRequest(
      { 'idempotency-key': KEY },
      () => ax.post(`${MS}/api/donaciones`, {}).catch(() => undefined),
      res,
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      IDEMPOTENT_REPLAYED_HEADER,
      'true',
    );
  });

  it('does not set the replay header on a first execution', async () => {
    const ax = instance();
    const res = { headersSent: false, setHeader: jest.fn() };
    await withinRequest(
      { 'idempotency-key': KEY },
      () => ax.post(`${MS}/api/donaciones`, {}),
      res,
    );
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});
