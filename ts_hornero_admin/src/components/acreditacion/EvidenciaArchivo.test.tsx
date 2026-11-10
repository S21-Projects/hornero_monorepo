import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EvidenciaArchivo } from './EvidenciaArchivo';
import { useEvidenciaArchivo } from '../../lib/hooks/useEvidenciaArchivo';

vi.mock('../../lib/hooks/useEvidenciaArchivo');

const useEvidenciaArchivoMock = vi.mocked(useEvidenciaArchivo);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * AD-12 (tesis-core-features slice 2): the shared FOTO/DOCUMENTO renderer used by AuditQueue,
 * legajo, and the referente's own acreditación view — an `<img>` for images, an "Abrir documento"
 * link otherwise, and an explicit "Archivo no disponible" state (403/404/unresolved key collapse
 * to the same UI, per `useEvidenciaArchivo`).
 */
describe('EvidenciaArchivo', () => {
  it('renders an img for an image/* content type', () => {
    useEvidenciaArchivoMock.mockReturnValue({
      estado: 'ok',
      url: 'blob:mock-url',
      contentType: 'image/jpeg',
    });

    render(
      <EvidenciaArchivo organizacionId={5} objectKey="org-evidencia/5/foto.jpg" tipoEvidencia="FOTO" />,
    );

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'blob:mock-url');
  });

  it('renders a "Ver PDF" link for a PDF content type', () => {
    useEvidenciaArchivoMock.mockReturnValue({
      estado: 'ok',
      url: 'blob:mock-url',
      contentType: 'application/pdf',
    });

    render(
      <EvidenciaArchivo
        organizacionId={5}
        objectKey="org-evidencia/5/doc.pdf"
        tipoEvidencia="DOCUMENTO"
      />,
    );

    const link = screen.getByRole('link', { name: 'Ver PDF' });
    expect(link).toHaveAttribute('href', 'blob:mock-url');
  });

  it('renders an "Abrir documento" link for a non-image, non-PDF content type', () => {
    useEvidenciaArchivoMock.mockReturnValue({
      estado: 'ok',
      url: 'blob:mock-url',
      contentType: 'application/octet-stream',
    });

    render(
      <EvidenciaArchivo organizacionId={5} objectKey="org-evidencia/5/doc.bin" tipoEvidencia="DOCUMENTO" />,
    );

    expect(screen.getByRole('link', { name: 'Abrir documento' })).toBeInTheDocument();
  });

  it('renders a PDF as a link, never an img, even for a FOTO tipo', () => {
    useEvidenciaArchivoMock.mockReturnValue({
      estado: 'ok',
      url: 'blob:mock-url',
      contentType: 'application/pdf',
    });

    render(
      <EvidenciaArchivo organizacionId={5} objectKey="org-evidencia/5/x.pdf" tipoEvidencia="FOTO" size="thumbnail" />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver PDF' })).toBeInTheDocument();
  });

  it('renders "Archivo no disponible" when the hook reports unavailable', () => {
    useEvidenciaArchivoMock.mockReturnValue({ estado: 'unavailable', url: null, contentType: null });

    render(
      <EvidenciaArchivo organizacionId={5} objectKey="org-evidencia/5/foto.jpg" tipoEvidencia="FOTO" />,
    );

    expect(screen.getByText('Archivo no disponible')).toBeInTheDocument();
  });

  it('renders "Archivo no disponible" for an unresolvable objectKey without calling the hook for a path', () => {
    useEvidenciaArchivoMock.mockReturnValue({ estado: 'unavailable', url: null, contentType: null });

    render(<EvidenciaArchivo organizacionId={5} objectKey={null} tipoEvidencia="FOTO" />);

    expect(screen.getByText('Archivo no disponible')).toBeInTheDocument();
    expect(useEvidenciaArchivoMock).toHaveBeenCalledWith(null);
  });
});
