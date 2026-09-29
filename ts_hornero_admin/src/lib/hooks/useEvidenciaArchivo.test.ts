import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { api } from '../axios';
import { useEvidenciaArchivo } from './useEvidenciaArchivo';

vi.mock('../axios', () => ({
  api: { get: vi.fn() },
}));

/**
 * AD-12 (tesis-core-features slice 2): fetches an evidence file as a blob through the
 * authenticated `evidencia-files` route (never a bare `<img src>` — the interceptor-driven
 * 401/refresh/retry flow only applies to `api` requests), turns it into an object URL, and revokes
 * it on unmount to avoid leaking memory across audit-queue/legajo navigations.
 */
describe('useEvidenciaArchivo', () => {
  const getMock = api.get as unknown as ReturnType<typeof vi.fn>;
  const createObjectURL = vi.fn(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    getMock.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('fetches the path as a blob and exposes an object URL', async () => {
    const blob = new Blob(['fake'], { type: 'image/jpeg' });
    getMock.mockResolvedValueOnce({ data: blob, headers: { 'content-type': 'image/jpeg' } });

    const { result } = renderHook(() => useEvidenciaArchivo('/evidencia-files/5/foto.jpg'));

    await waitFor(() => expect(result.current.estado).toBe('ok'));
    expect(getMock).toHaveBeenCalledWith('/evidencia-files/5/foto.jpg', { responseType: 'blob' });
    expect(result.current.url).toBe('blob:mock-url');
    expect(result.current.contentType).toBe('image/jpeg');
  });

  it('revokes the object URL on unmount', async () => {
    const blob = new Blob(['fake'], { type: 'image/jpeg' });
    getMock.mockResolvedValueOnce({ data: blob, headers: { 'content-type': 'image/jpeg' } });

    const { result, unmount } = renderHook(() => useEvidenciaArchivo('/evidencia-files/5/foto.jpg'));
    await waitFor(() => expect(result.current.estado).toBe('ok'));

    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('maps a 403 to an unavailable result', async () => {
    getMock.mockRejectedValueOnce({ response: { status: 403 } });

    const { result } = renderHook(() => useEvidenciaArchivo('/evidencia-files/5/foto.jpg'));

    await waitFor(() => expect(result.current.estado).toBe('unavailable'));
    expect(result.current.url).toBeNull();
  });

  it('maps a 404 to an unavailable result', async () => {
    getMock.mockRejectedValueOnce({ response: { status: 404 } });

    const { result } = renderHook(() => useEvidenciaArchivo('/evidencia-files/5/foto.jpg'));

    await waitFor(() => expect(result.current.estado).toBe('unavailable'));
  });

  it('is unavailable immediately when path is null', () => {
    const { result } = renderHook(() => useEvidenciaArchivo(null));

    expect(result.current.estado).toBe('unavailable');
    expect(getMock).not.toHaveBeenCalled();
  });
});
