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

  it('offers DECLARACION, FOTO and DOCUMENTO, all selectable', () => {
    render(<EvidenciaForm organizacionId={5} requisito="NO_DISCRIMINACION" />, { wrapper: Wrapper });

    const tipoSelect = screen.getByLabelText(/tipo de evidencia/i) as HTMLSelectElement;
    const options = within(tipoSelect).getAllByRole('option') as HTMLOptionElement[];

    const foto = options.find((o) => o.value === 'FOTO');
    const documento = options.find((o) => o.value === 'DOCUMENTO');

    expect(foto).toBeDefined();
    expect(foto?.disabled).toBe(false);
    expect(documento).toBeDefined();
    expect(documento?.disabled).toBe(false);
    expect(tipoSelect.disabled).toBe(false);
  });

  it('selecting FOTO reveals a file input and uploads through upload/org-evidencia/:id on file selection', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { key: 'org-evidencia/5/123.jpg' } });
    const user = userEvent.setup();

    render(<EvidenciaForm organizacionId={5} requisito="NO_DISCRIMINACION" />, { wrapper: Wrapper });

    await user.selectOptions(screen.getByLabelText(/tipo de evidencia/i), 'FOTO');

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

    await user.selectOptions(screen.getByLabelText(/tipo de evidencia/i), 'FOTO');
    const fileInput = screen.getByLabelText(/archivo/i) as HTMLInputElement;
    const file = new File(['fake'], 'foto.jpg', { type: 'image/jpeg' });
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: /enviar/i }));

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

    await user.type(screen.getByLabelText(/declaraci/i), 'No discriminamos por ningún motivo');
    await user.click(screen.getByRole('button', { name: /enviar/i }));

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
