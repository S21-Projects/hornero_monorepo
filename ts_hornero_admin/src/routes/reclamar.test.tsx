import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReclamarPage from './reclamar';
import { useCrearReclamo, useOrganizacionPorSlug } from '../lib/hooks/useReclamos';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useUploadReclamoEvidencia } from '../lib/hooks/useUploadOrgImagen';

vi.mock('../lib/hooks/useReclamos', () => ({
  useOrganizacionPorSlug: vi.fn(),
  useCrearReclamo: vi.fn(),
}));
vi.mock('../lib/hooks/useMisOrganizaciones', () => ({ useMisOrganizaciones: vi.fn() }));
vi.mock('../lib/hooks/useUploadOrgImagen', () => ({ useUploadReclamoEvidencia: vi.fn() }));

const ORG = {
  id: 4,
  slug: 'comedor-x-1',
  nombre: 'Comedor X',
  direccion: 'Calle 1, Córdoba',
  estado: 'SIN_RECLAMAR',
};

const CREAR = vi.fn();
const UPLOAD = vi.fn();

function mockOrg(data: unknown, extra: Record<string, unknown> = {}) {
  vi.mocked(useOrganizacionPorSlug).mockReturnValue({
    data, isLoading: false, isError: false, refetch: vi.fn(), ...extra,
  } as unknown as ReturnType<typeof useOrganizacionPorSlug>);
}

function mockMias(estados: string[]) {
  vi.mocked(useMisOrganizaciones).mockReturnValue({
    data: estados.map((estado, i) => ({ id: i + 100, estado })),
  } as unknown as ReturnType<typeof useMisOrganizaciones>);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reclamar/comedor-x-1']}>
      <Routes>
        <Route path="/reclamar/:slug" element={<ReclamarPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillValid() {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText('Tu rol en el comedor'), 'VOLUNTARIO');
  await user.type(screen.getByLabelText('Teléfono de contacto'), '351 555 1234');
  fireEvent.change(screen.getByLabelText(/Evidencia/), {
    target: { files: [new File(['x'], 'frente.jpg', { type: 'image/jpeg' })] },
  });
  await screen.findByText('frente.jpg');
  return user;
}

describe('ReclamarPage', () => {
  beforeEach(() => {
    CREAR.mockReset().mockResolvedValue({ id: 1 });
    UPLOAD.mockReset().mockResolvedValue({ key: 'reclamo-evidencia/4/7/1.jpg' });
    mockOrg(ORG);
    mockMias(['APROBADA']);
    vi.mocked(useCrearReclamo).mockReturnValue({
      mutateAsync: CREAR, isPending: false, isError: false, error: null,
    } as unknown as ReturnType<typeof useCrearReclamo>);
    vi.mocked(useUploadReclamoEvidencia).mockReturnValue({
      mutateAsync: UPLOAD, isPending: false, isError: false,
    } as unknown as ReturnType<typeof useUploadReclamoEvidencia>);
  });

  it('looks the organizacion up by the slug in the URL and shows it with its estado', () => {
    renderPage();

    expect(useOrganizacionPorSlug).toHaveBeenCalledWith('comedor-x-1');
    expect(screen.getByText('Comedor X')).toBeInTheDocument();
    expect(screen.getByText('Calle 1, Córdoba')).toBeInTheDocument();
    expect(screen.getByText('Sin reclamar')).toBeInTheDocument();
    expect(screen.getByText(/Un administrador revisa cada reclamo/)).toBeInTheDocument();
  });

  it('offers the three roles of the mockup', () => {
    renderPage();

    expect(screen.getByRole('option', { name: 'Responsable / coordinador/a' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Voluntario/a' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Integrante de la organización que lo sostiene' }),
    ).toBeInTheDocument();
  });

  it('validates the required fields before sending anything', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Enviar reclamo' }));

    expect(screen.getByText('Indicá tu rol en el comedor')).toBeInTheDocument();
    expect(screen.getByText('Ingresá un teléfono de contacto válido')).toBeInTheDocument();
    expect(screen.getByText('Adjuntá al menos una foto como evidencia')).toBeInTheDocument();
    expect(CREAR).not.toHaveBeenCalled();
  });

  it('uploads the evidence for the claimed organizacion and submits the claim with its key', async () => {
    renderPage();
    const user = await fillValid();
    await user.type(screen.getByLabelText('Mensaje (opcional)'), '  Soy la coordinadora  ');

    await user.click(screen.getByRole('button', { name: 'Enviar reclamo' }));

    expect(UPLOAD).toHaveBeenCalledWith({ organizacionId: 4, file: expect.any(File) });
    await waitFor(() =>
      expect(CREAR).toHaveBeenCalledWith({
        organizacionId: 4,
        rol: 'VOLUNTARIO',
        telefono: '351 555 1234',
        mensaje: 'Soy la coordinadora',
        evidenciaKeys: ['reclamo-evidencia/4/7/1.jpg'],
      }),
    );
    expect(await screen.findByText('Recibimos tu reclamo')).toBeInTheDocument();
  });

  it('lets the claimant remove an uploaded file', async () => {
    renderPage();
    const user = await fillValid();

    await user.click(screen.getByRole('button', { name: 'Quitar frente.jpg' }));

    expect(screen.queryByText('frente.jpg')).not.toBeInTheDocument();
  });

  it('shows the mapped error when the MS refuses the claim', async () => {
    CREAR.mockRejectedValue({ response: { status: 409, data: { message: 'Ya tenés un reclamo pendiente para este comedor' } } });
    vi.mocked(useCrearReclamo).mockReturnValue({
      mutateAsync: CREAR, isPending: false, isError: true,
      error: { response: { status: 409, data: { message: 'Ya tenés un reclamo pendiente para este comedor' } } },
    } as unknown as ReturnType<typeof useCrearReclamo>);
    renderPage();

    expect(screen.getByText('Ya tenés un reclamo pendiente para este comedor.')).toBeInTheDocument();
  });

  it('blocks the claim when the referente already has three organizaciones (rejected ones do not count)', () => {
    mockMias(['APROBADA', 'PENDIENTE', 'APROBADA']);
    renderPage();

    expect(screen.getByText(/no podés reclamar otra/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar reclamo' })).toBeDisabled();
  });

  it('does not count a rejected organizacion against the cap', () => {
    mockMias(['APROBADA', 'RECHAZADA', 'APROBADA']);
    renderPage();

    expect(screen.queryByText(/no podés reclamar otra/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar reclamo' })).toBeEnabled();
  });

  it('shows no form for an organizacion that is not unclaimed', () => {
    mockOrg({ ...ORG, estado: 'APROBADA' });
    renderPage();

    expect(screen.getByText('Este comedor no está disponible para ser reclamado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar reclamo' })).not.toBeInTheDocument();
  });

  it('shows the error state when the organizacion cannot be loaded', () => {
    mockOrg(undefined, { isError: true });
    renderPage();

    expect(screen.queryByText('Comedor X')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar reclamo' })).not.toBeInTheDocument();
  });
});
