import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { EvidenciaForm } from './EvidenciaForm';
import { InfoPublicaForm } from '../org/InfoPublicaForm';
import { api } from '../../lib/axios';

vi.mock('../../lib/axios', () => ({
  api: { patch: vi.fn(), post: vi.fn() },
}));

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('EvidenciaForm', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it('offers DECLARACION, FOTO and DOCUMENTO as radio options, Declaración selected by default', () => {
    render(<EvidenciaForm organizacionId={5} requisito="NO_DISCRIMINACION" />, { wrapper: Wrapper });

    const group = screen.getByRole('group', { name: /tipo de evidencia/i });
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];

    expect(radios.map((r) => r.value)).toEqual(['DECLARACION', 'FOTO', 'DOCUMENTO']);
    expect(radios.every((r) => !r.disabled)).toBe(true);
    expect(screen.getByRole('radio', { name: 'Declaración' })).toBeChecked();
  });

  it('selecting FOTO reveals a file input and uploads through upload/org-evidencia/:id on file selection', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { key: 'org-evidencia/5/123.jpg' } });
    const user = userEvent.setup();

    render(<EvidenciaForm organizacionId={5} requisito="NO_DISCRIMINACION" />, { wrapper: Wrapper });

    await user.click(screen.getByRole('radio', { name: 'Foto' }));

    const fileInput = screen.getByLabelText(/archivo/i) as HTMLInputElement;
    const file = new File(['fake'], 'foto.jpg', { type: 'image/jpeg' });
    await user.upload(fileInput, file);

    expect(api.post).toHaveBeenCalledWith(
      '/upload/org-evidencia/5',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }),
    );
  });

  it('submits a FOTO evidence row with the uploaded objectKey, not a declaracion', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { key: 'org-evidencia/5/123.jpg' } })
      .mockResolvedValueOnce({
        data: { id: 2, organizacionId: 5, requisito: 'NO_DISCRIMINACION', tipoEvidencia: 'FOTO', estado: 'PENDIENTE' },
      });
    const user = userEvent.setup();

    render(<EvidenciaForm organizacionId={5} requisito="NO_DISCRIMINACION" />, { wrapper: Wrapper });

    await user.click(screen.getByRole('radio', { name: 'Foto' }));
    const fileInput = screen.getByLabelText(/archivo/i) as HTMLInputElement;
    const file = new File(['fake'], 'foto.jpg', { type: 'image/jpeg' });
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: 'Enviar a auditoría' }));

    expect(api.post).toHaveBeenLastCalledWith(
      '/organizaciones/5/acreditacion/evidencias',
      expect.objectContaining({
        requisito: 'NO_DISCRIMINACION',
        tipoEvidencia: 'FOTO',
        objectKey: 'org-evidencia/5/123.jpg',
      }),
   
      expect.objectContaining({ headers: { 'Idempotency-Key': expect.any(String) } }),
    );
  });

  it('submits a DECLARACION-only evidence row', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { id: 1, organizacionId: 5, requisito: 'NO_DISCRIMINACION', tipoEvidencia: 'DECLARACION', estado: 'PENDIENTE' },
    });
    const user = userEvent.setup();

    render(<EvidenciaForm organizacionId={5} requisito="NO_DISCRIMINACION" />, { wrapper: Wrapper });

    await user.type(screen.getByLabelText('Declaración', { selector: 'textarea' }), 'No discriminamos por ningún motivo');
    await user.click(screen.getByRole('button', { name: 'Enviar a auditoría' }));

    expect(api.post).toHaveBeenCalledWith(
      '/organizaciones/5/acreditacion/evidencias',
      expect.objectContaining({
        requisito: 'NO_DISCRIMINACION',
        tipoEvidencia: 'DECLARACION',
        declaracion: 'No discriminamos por ningún motivo',
      }),
   
      expect.objectContaining({ headers: { 'Idempotency-Key': expect.any(String) } }),
    );
  });

  it('auto-selects FOTO for an image and DOCUMENTO for a PDF, explains why, and the user can still change it', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { key: 'org-evidencia/5/x' } });
    const user = userEvent.setup();

    render(<EvidenciaForm organizacionId={5} requisito="NO_DISCRIMINACION" />, { wrapper: Wrapper });

    await user.click(screen.getByRole('radio', { name: 'Documento' }));
    await user.upload(
      screen.getByLabelText(/archivo/i),
      new File(['fake'], 'foto.png', { type: 'image/png' }),
    );
    expect(screen.getByRole('radio', { name: 'Foto' })).toBeChecked();
    expect(
      screen.getByText('Se eligió Foto porque el archivo es una imagen. Podés cambiarlo.'),
    ).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText(/archivo/i),
      new File(['fake'], 'acta.pdf', { type: 'application/pdf' }),
    );
    expect(screen.getByRole('radio', { name: 'Documento' })).toBeChecked();
    expect(screen.getByText(/porque el archivo es un PDF/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Foto' }));
    expect(screen.getByRole('radio', { name: 'Foto' })).toBeChecked();
    expect(screen.queryByText(/Se eligió/)).not.toBeInTheDocument();
    expect(screen.getByText(/archivo listo: acta\.pdf/i)).toBeInTheDocument();
  });

  it('accepts only JPEG, PNG and PDF in the file input (no WebP)', async () => {
    const user = userEvent.setup();
    render(<EvidenciaForm organizacionId={5} requisito="NO_DISCRIMINACION" />, { wrapper: Wrapper });

    await user.click(screen.getByRole('radio', { name: 'Documento' }));

    expect(screen.getByLabelText(/archivo/i)).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,application/pdf',
    );
  });

  it('shows a preview row with name, size and a Cambiar button once a file is chosen', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { key: 'org-evidencia/5/x' } });
    const user = userEvent.setup();
    render(<EvidenciaForm organizacionId={5} requisito="NO_DISCRIMINACION" />, { wrapper: Wrapper });

    await user.click(screen.getByRole('radio', { name: 'Documento' }));
    await user.upload(
      screen.getByLabelText(/archivo/i),
      new File([new Uint8Array(2048)], 'acta.pdf', { type: 'application/pdf' }),
    );

    expect(screen.getAllByText('acta.pdf').length).toBeGreaterThan(0);
    expect(screen.getByText('2 KB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar' })).toBeInTheDocument();
  });

  it('blocks files over 5 MB without uploading them', async () => {
    const user = userEvent.setup();
    render(<EvidenciaForm organizacionId={5} requisito="NO_DISCRIMINACION" />, { wrapper: Wrapper });

    await user.click(screen.getByRole('radio', { name: 'Foto' }));
    await user.upload(
      screen.getByLabelText(/archivo/i),
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.jpg', { type: 'image/jpeg' }),
    );

    expect(screen.getByText(/supera los 5 MB/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Enviar a auditoría' })).toBeDisabled();
  });

  it('shows Cancelar only when onCancel is given and calls it', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <EvidenciaForm organizacionId={5} requisito="NO_DISCRIMINACION" />,
      { wrapper: Wrapper },
    );
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();

    rerender(<EvidenciaForm organizacionId={5} requisito="NO_DISCRIMINACION" onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows the proof hint for the requisito', () => {
    render(<EvidenciaForm organizacionId={5} requisito="SERVICIO_REGULAR_GRATUITO" />, { wrapper: Wrapper });

    expect(screen.getByText(/foto del espacio donde sirven la comida/i)).toBeInTheDocument();
  });

  it('calls onSubmitted and resets its fields after a successful submit', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 1 } });
    const onSubmitted = vi.fn();
    const user = userEvent.setup();

    render(
      <EvidenciaForm organizacionId={5} requisito="NO_DISCRIMINACION" onSubmitted={onSubmitted} />,
      { wrapper: Wrapper },
    );

    await user.type(screen.getByLabelText('Declaración', { selector: 'textarea' }), 'Texto');
    await user.click(screen.getByRole('button', { name: 'Enviar a auditoría' }));

    await vi.waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Declaración', { selector: 'textarea' })).toHaveValue('');
  });

  it('renders as a visually and structurally separate section from InfoPublicaForm when both are mounted', () => {
    render(
      <div>
        <section aria-label="Información pública">
          <InfoPublicaForm
            mode="referente"
            org={{ id: 5, aceptaDonaciones: true, sitioWebUrl: '', donacionDirectaUrl: '', infoPublicaPendienteEn: null }}
          />
        </section>
        <section aria-label="Evidencia de acreditación">
          <EvidenciaForm organizacionId={5} requisito="NO_DISCRIMINACION" />
        </section>
      </div>,
      { wrapper: Wrapper },
    );

    const infoSection = screen.getByLabelText('Información pública');
    const evidenciaSection = screen.getByLabelText('Evidencia de acreditación');

    expect(infoSection).not.toBe(evidenciaSection);
    expect(infoSection.contains(evidenciaSection)).toBe(false);
    expect(evidenciaSection.contains(infoSection)).toBe(false);
  });
});
