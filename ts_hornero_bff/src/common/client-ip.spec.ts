import axios from 'axios';
import {
  CLIENT_IP_HEADER,
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

  const withinRequest = (headers: Record<string, string>, fn: () => Promise<unknown>) =>
    new Promise<void>((resolve, reject) => {
      clientIpMiddleware({ headers, ip: '172.18.0.1' } as any, {} as any, () => {
        fn().then(() => resolve(), reject);
      });
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
