import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EscanerQr } from './EscanerQr';

/**
 * Spec `donacion-entrega-codigo` — the scan action is optional and the typed input always stays
 * usable (mockup: "Escanear código de la organización" button + typed fallback below it). Mocks
 * the adapter module (`vi.mock`), never the camera track internals directly — but `getUserMedia`
 * itself is stubbed since jsdom has no camera.
 */
const iniciarMock = vi.fn();
const detenerMock = vi.fn();

vi.mock('../../lib/qr/escanearQr', () => ({
  iniciar: iniciarMock,
  detener: detenerMock,
}));

describe('EscanerQr', () => {
  let getUserMediaMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    iniciarMock.mockReset().mockResolvedValue(undefined);
    detenerMock.mockReset();
    getUserMediaMock = vi.fn();
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaMock },
      configurable: true,
    });
    // jsdom's <video> has no real play(); stub it so the component's await doesn't hang.
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the scan button and the typed input together', () => {
    render(<EscanerQr donacionId={42} onCodigo={vi.fn()} />);

    expect(screen.getByRole('button', { name: /escanear código/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/código/i)).toBeInTheDocument();
  });

  it('defaults the scan label to the organización (donante viewer)', () => {
    render(<EscanerQr donacionId={42} onCodigo={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Escanear código de la organización' }),
    ).toBeInTheDocument();
  });

  it('shows the donante-facing label when the viewer is the referente', () => {
    render(<EscanerQr donacionId={42} onCodigo={vi.fn()} contraparte="DONANTE" />);

    expect(
      screen.getByRole('button', { name: 'Escanear código del donante' }),
    ).toBeInTheDocument();
  });

  it('starts the camera and the adapter on tap', async () => {
    const stream = { getTracks: () => [{ stop: vi.fn() }] };
    getUserMediaMock.mockResolvedValue(stream);
    const user = userEvent.setup();
    render(<EscanerQr donacionId={42} onCodigo={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /escanear código/i }));

    await waitFor(() => expect(iniciarMock).toHaveBeenCalledTimes(1));
    expect(getUserMediaMock).toHaveBeenCalled();
  });

  it('stops the adapter and the camera tracks when stopping', async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] };
    getUserMediaMock.mockResolvedValue(stream);
    const user = userEvent.setup();
    render(<EscanerQr donacionId={42} onCodigo={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /escanear código/i }));
    await waitFor(() => expect(iniciarMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /detener/i }));

    expect(detenerMock).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });

  it('shows a fallback reason when camera permission is denied, and the typed input stays usable', async () => {
    getUserMediaMock.mockRejectedValue(new Error('Permission denied'));
    const user = userEvent.setup();
    const onCodigo = vi.fn();
    render(<EscanerQr donacionId={42} onCodigo={onCodigo} />);

    await user.click(screen.getByRole('button', { name: /escanear código/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(iniciarMock).not.toHaveBeenCalled();

    const input = screen.getByLabelText(/código/i);
    await user.type(input, '482913');
    await user.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(onCodigo).toHaveBeenCalledWith('482913');
  });

  it('calls onCodigo with the parsed code when the adapter decodes a matching payload', async () => {
    const stream = { getTracks: () => [{ stop: vi.fn() }] };
    getUserMediaMock.mockResolvedValue(stream);
    const onCodigo = vi.fn();
    let onPayload: ((payload: string) => void) | undefined;
    iniciarMock.mockImplementation((_video, cb) => {
      onPayload = cb;
      return Promise.resolve();
    });
    const user = userEvent.setup();
    render(<EscanerQr donacionId={42} onCodigo={onCodigo} />);

    await user.click(screen.getByRole('button', { name: /escanear código/i }));
    await waitFor(() => expect(iniciarMock).toHaveBeenCalledTimes(1));

    onPayload?.('HORNERO-ENTREGA:42:482913');

    expect(onCodigo).toHaveBeenCalledWith('482913');
  });

  it('ignores a decoded payload for a different donacionId', async () => {
    const stream = { getTracks: () => [{ stop: vi.fn() }] };
    getUserMediaMock.mockResolvedValue(stream);
    const onCodigo = vi.fn();
    let onPayload: ((payload: string) => void) | undefined;
    iniciarMock.mockImplementation((_video, cb) => {
      onPayload = cb;
      return Promise.resolve();
    });
    const user = userEvent.setup();
    render(<EscanerQr donacionId={42} onCodigo={onCodigo} />);

    await user.click(screen.getByRole('button', { name: /escanear código/i }));
    await waitFor(() => expect(iniciarMock).toHaveBeenCalledTimes(1));

    onPayload?.('HORNERO-ENTREGA:99:482913');

    expect(onCodigo).not.toHaveBeenCalled();
  });
});
