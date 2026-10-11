import { ClientIpThrottlerGuard } from './client-ip-throttler.guard';

describe('ClientIpThrottlerGuard.getTracker', () => {
  // getTracker is protected; expose it without building the whole Nest DI graph.
  const tracker = (req: Record<string, any>) =>
    (ClientIpThrottlerGuard.prototype as any).getTracker.call({}, req);

  it('prefers cf-connecting-ip over the socket address', async () => {
    await expect(
      tracker({
        headers: { 'cf-connecting-ip': '203.0.113.7' },
        ip: '172.18.0.1',
      }),
    ).resolves.toBe('203.0.113.7');
  });

  it('falls back to req.ip when the header is absent', async () => {
    await expect(tracker({ headers: {}, ip: '172.18.0.1' })).resolves.toBe(
      '172.18.0.1',
    );
  });

  it('ignores a blank header', async () => {
    await expect(
      tracker({ headers: { 'cf-connecting-ip': '  ' }, ip: '172.18.0.1' }),
    ).resolves.toBe('172.18.0.1');
  });

  it('takes the first value if the header is repeated', async () => {
    await expect(
      tracker({
        headers: { 'cf-connecting-ip': ['203.0.113.7', '198.51.100.1'] },
        ip: 'x',
      }),
    ).resolves.toBe('203.0.113.7');
  });
});
