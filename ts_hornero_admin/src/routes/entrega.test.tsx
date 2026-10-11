import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EntregaPage from './entrega';
import { useAuthStore } from '../store/auth.store';
import { useDonacion } from '../lib/hooks/useDonacion';
import { useEstadoEntrega, useGenerarCodigo, useVerificarCodigo } from '../lib/hooks/useEntrega';
import type { Donacion } from '../types/domain';

/**
 * Task 3c.12 — route wiring RED. Mocks every data hook (each already unit-tested: useDonacion,
 * useEntrega's trio) and the camera-owning `EscanerQr` (already unit-tested in isolation), so this
 * suite exercises composition only: QR rendering from the generated code, the always-available
 * "Generar un código nuevo" action, wiring a scanned/typed code into verification, both parties'
 * status, and polling stopping at `ENTREGADA`.
 */
vi.mock('../lib/hooks/useDonacion', () => ({ useDonacion: vi.fn() }));
vi.mock('../lib/hooks/useEntrega', () => ({
  useEstadoEntrega: vi.fn(),
  useGenerarCodigo: vi.fn(),
  useVerificarCodigo: vi.fn(),
}));
vi.mock('../components/entrega/EscanerQr', () => ({
  EscanerQr: ({ onCodigo }: { onCodigo: (codigo: string) => void }) => (
    <button type="button" onClick={() => onCodigo('999999')}>
      Escanear (mock)
    </button>
  ),
}));

function renderPage(id = '1') {
  return render(
    <MemoryRouter initialEntries={[`/donaciones/${id}/entrega`]}>
      <Routes>
        <Route path="/donaciones/:id/entrega" element={<EntregaPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const donacion: Donacion = {
  id: 1,
  estado: 'EN_CAMINO',
  necesidadId: 5,
  organizacionId: 7,
  organizacionNombre: 'Comedor Sol',
  donanteName: 'Ana Donante',
};

describe('EntregaPage', () => {
  let generarMutate: ReturnType<typeof vi.fn>;
  let verificarMutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { userId: 2, nombre: 'Ana', email: 'a@test.com', tipo: 'DONANTE', emailVerificado: true },
    });

    vi.mocked(useDonacion).mockReturnValue({
      data: donacion,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useDonacion>);

    generarMutate = vi.fn();
    vi.mocked(useGenerarCodigo).mockReturnValue({
      mutate: generarMutate,
      isPending: false,
      isError: false,
      data: undefined,
    } as unknown as ReturnType<typeof useGenerarCodigo>);

    verificarMutate = vi.fn();
    vi.mocked(useVerificarCodigo).mockReturnValue({
      mutate: verificarMutate,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useVerificarCodigo>);

    vi.mocked(useEstadoEntrega).mockReturnValue({
      data: { estado: 'EN_CAMINO', confirmadaDonanteEn: null, confirmadaReferenteEn: null },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useEstadoEntrega>);
  });

  it('generates a code on mount and renders the QR once it resolves', () => {
    vi.mocked(useGenerarCodigo).mockReturnValue({
      mutate: generarMutate,
      isPending: false,
      isError: false,
      data: { codigo: '482913', expiraEn: new Date(Date.now() + 90_000).toISOString() },
    } as unknown as ReturnType<typeof useGenerarCodigo>);

    renderPage();

    expect(generarMutate).toHaveBeenCalled();
    expect(screen.getByText('482913')).toBeInTheDocument();
    expect(screen.getByText(/Vence en/)).toBeInTheDocument();
  });

  it('always offers "Generar un código nuevo", including after the code expires', () => {
    vi.mocked(useGenerarCodigo).mockReturnValue({
      mutate: generarMutate,
      isPending: false,
      isError: false,
      data: { codigo: '482913', expiraEn: new Date(Date.now() - 1000).toISOString() },
    } as unknown as ReturnType<typeof useGenerarCodigo>);

    renderPage();

    expect(screen.getByRole('button', { name: /generar un código nuevo/i })).toBeInTheDocument();
  });

  it('verifies the counterpart code when the scanner (mocked adapter) reports one, no reload', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /escanear \(mock\)/i }));

    expect(verificarMutate).toHaveBeenCalledWith('999999');
  });

  it("shows both parties' status and hides the code UI once ENTREGADA (polling stops)", () => {
    vi.mocked(useEstadoEntrega).mockReturnValue({
      data: {
        estado: 'ENTREGADA',
        confirmadaDonanteEn: '2026-09-30T10:00:00Z',
        confirmadaReferenteEn: '2026-09-30T10:01:00Z',
      },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useEstadoEntrega>);

    renderPage();

    expect(screen.getByText('Entregada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generar un código nuevo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /escanear \(mock\)/i })).not.toBeInTheDocument();
  });

  it('shows "Donación #id" and the counterpart name (organización) for a donante viewer', () => {
    renderPage();

    expect(screen.getByText(/Donación #1/)).toBeInTheDocument();
    expect(screen.getByText(/Comedor Sol/)).toBeInTheDocument();
  });

  it('shows the donante as the counterpart for a referente viewer', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { userId: 3, nombre: 'Referente', email: 'r@test.com', tipo: 'REFERENTE', emailVerificado: true },
    });

    renderPage();

    expect(screen.getByText(/Ana Donante/)).toBeInTheDocument();
  });

  it('renders without a counterpart name when the donor is masked (null)', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { userId: 9, nombre: 'Ref', email: 'r@test.com', tipo: 'REFERENTE', emailVerificado: true },
    });
    vi.mocked(useDonacion).mockReturnValue({
      data: { ...donacion, donanteName: null, donanteId: null },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useDonacion>);

    renderPage();

    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ana Donante/)).not.toBeInTheDocument();
  });
});
