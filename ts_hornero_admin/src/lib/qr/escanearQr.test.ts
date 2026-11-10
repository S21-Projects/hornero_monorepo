import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * AD-7 (tesis-core-features slice 3c-i): the adapter uses the native `BarcodeDetector` when the
 * runtime exposes it, and falls back to the `barcode-detector` ponyfill otherwise (jsdom has
 * neither, so every test here exercises the fallback import path). Never mock the camera — mock
 * the underlying scanner library only.
 */
const detectMock = vi.fn();
const BarcodeDetectorCtorMock = vi.fn(function BarcodeDetectorMock(this: { detect: typeof detectMock }) {
  this.detect = detectMock;
});

vi.mock('barcode-detector/pure', () => ({
  BarcodeDetector: BarcodeDetectorCtorMock,
}));

describe('escanearQr', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    detectMock.mockReset();
    BarcodeDetectorCtorMock.mockClear();
  });

  afterEach(async () => {
    const { detener } = await import('./escanearQr');
    detener();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('invokes the callback with the decoded payload', async () => {
    const { iniciar } = await import('./escanearQr');
    detectMock.mockResolvedValue([{ rawValue: 'HORNERO-ENTREGA:42:482913' }]);
    const onPayload = vi.fn();
    const video = document.createElement('video');

    await iniciar(video, onPayload);
    await vi.advanceTimersByTimeAsync(400);

    expect(onPayload).toHaveBeenCalledWith('HORNERO-ENTREGA:42:482913');
  });

  it('creates the detector scoped to qr_code and reuses it across ticks', async () => {
    const { iniciar } = await import('./escanearQr');
    detectMock.mockResolvedValue([]);
    const video = document.createElement('video');

    await iniciar(video, vi.fn());
    await vi.advanceTimersByTimeAsync(1000);

    expect(BarcodeDetectorCtorMock).toHaveBeenCalledWith({ formats: ['qr_code'] });
    expect(BarcodeDetectorCtorMock).toHaveBeenCalledTimes(1);
  });

  it('does not invoke the callback when nothing is decoded', async () => {
    const { iniciar } = await import('./escanearQr');
    detectMock.mockResolvedValue([]);
    const onPayload = vi.fn();
    const video = document.createElement('video');

    await iniciar(video, onPayload);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onPayload).not.toHaveBeenCalled();
  });

  it('detener stops further detection ticks', async () => {
    const { iniciar, detener } = await import('./escanearQr');
    detectMock.mockResolvedValue([{ rawValue: '482913' }]);
    const onPayload = vi.fn();
    const video = document.createElement('video');

    await iniciar(video, onPayload);
    detener();
    await vi.advanceTimersByTimeAsync(2000);

    expect(onPayload).not.toHaveBeenCalled();
  });

  it('a fresh iniciar() after detener() starts cleanly again', async () => {
    const { iniciar, detener } = await import('./escanearQr');
    detectMock.mockResolvedValue([{ rawValue: '482913' }]);
    const onPayload = vi.fn();
    const video = document.createElement('video');

    await iniciar(video, onPayload);
    detener();
    await iniciar(video, onPayload);
    await vi.advanceTimersByTimeAsync(400);

    expect(onPayload).toHaveBeenCalledWith('482913');
  });
});
