import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import AcreditacionPage from './acreditacion';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useLegajo } from '../lib/hooks/useAcreditacion';
import { api } from '../lib/axios';
import type { LegajoResponse, Organizacion } from '../types/domain';

vi.mock('../lib/axios', () => ({ api: { post: vi.fn(), patch: vi.fn() } }));

vi.mock('../lib/hooks/useMisOrganizaciones', () => ({
  useMisOrganizaciones: vi.fn(),
}));

vi.mock('../lib/hooks/useAcreditacion', async () => {
  const actual = await vi.importActual<typeof import('../lib/hooks/useAcreditacion')>(
    '../lib/hooks/useAcreditacion',
  );
  return {
    ...actual,
    useLegajo: vi.fn(),
  };
});

// task 2.24 (AD-12 follow-up): the referente's own view stubs EvidenciaArchivo here —
// EvidenciaArchivo's own rendering behavior is covered by EvidenciaArchivo.test.tsx.
vi.mock('../components/acreditacion/EvidenciaArchivo', () => ({
  EvidenciaArchivo: ({ objectKey }: { objectKey: string | null | undefined }) => (
    <div data-testid="evidencia-archivo">{objectKey}</div>
  ),
}));

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const ORGANIZACION: Organizacion = {
  id: 5,
  slug: 'comedor-los-hornitos',
  nombre: 'Comedor Los Hornitos',
  validada: true,
  estado: 'APROBADA',
  aceptaDonaciones: false,
};

const BASE_REQUISITO = {
  requisito: 'NO_DISCRIMINACION' as const,
  nivelExigido: 'N1' as const,
  estado: 'PENDIENTE' as const,
  tipoEvidencia: 'DECLARACION' as const,
  declaracion: 'No discriminamos',
  validoDesde: '2026-01-01',
  validoHasta: null,
  expirada: false,
  auditorNombre: null,
  auditadoEn: null,
  objectKey: null,
};

function buildLegajo(
  requisitos: LegajoResponse['requisitos'],
  nivel: LegajoResponse['nivel'] = 'N1',
): LegajoResponse {
  return {
    organizacionId: 5,
    nombre: 'Comedor Los Hornitos',
    slug: 'comedor-los-hornitos',
    direccion: 'Av. Colón 1234',
    nivel,
    nivelDesde: '2026-01-01T00:00:00Z',
    requisitos,
    eventos: [],
    cumplimiento: { entregadas: 0, rechazadas: 0, tasa: null },
    disclosure: 'Datos declarados y auditados, no verificados por el sistema.',
  };
}

describe('AcreditacionPage — task 2.24 (AD-12 follow-up)', () => {
  beforeEach(() => {
    vi.mocked(useMisOrganizaciones).mockReturnValue({
      data: [ORGANIZACION],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMisOrganizaciones>);
  });

  it('renders EvidenciaArchivo for a FOTO requisito with a known objectKey', () => {
    vi.mocked(useLegajo).mockReturnValue({
      data: buildLegajo([
        {
          ...BASE_REQUISITO,
          requisito: 'CONDICIONES_SANITARIAS_ADECUADAS',
          tipoEvidencia: 'FOTO',
          declaracion: null,
          objectKey: 'org-evidencia/5/foto.jpg',
        },
      ]),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useLegajo>);

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByTestId('evidencia-archivo')).toHaveTextContent('org-evidencia/5/foto.jpg');
  });

  it('renders EvidenciaArchivo for a DOCUMENTO requisito with a known objectKey', () => {
    vi.mocked(useLegajo).mockReturnValue({
      data: buildLegajo([
        {
          ...BASE_REQUISITO,
          requisito: 'RADIO_50KM_BANCO_ALIMENTOS',
          tipoEvidencia: 'DOCUMENTO',
          declaracion: null,
          objectKey: 'org-evidencia/5/doc.pdf',
        },
      ]),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useLegajo>);

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByTestId('evidencia-archivo')).toHaveTextContent('org-evidencia/5/doc.pdf');
  });

  it('renders human labels for requisito codes and falls back to the raw code when unknown', () => {
    vi.mocked(useLegajo).mockReturnValue({
      data: buildLegajo([
        BASE_REQUISITO,
        { ...BASE_REQUISITO, requisito: 'SERVICIO_REGULAR_GRATUITO' },
        { ...BASE_REQUISITO, requisito: 'CODIGO_NUEVO' as never },
      ]),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useLegajo>);

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByText('Sin discriminación')).toBeInTheDocument();
    expect(screen.getByText('Servicio regular y gratuito')).toBeInTheDocument();
    expect(screen.queryByText('NO_DISCRIMINACION')).not.toBeInTheDocument();
    expect(screen.getByText('CODIGO_NUEVO')).toBeInTheDocument();
  });

  it('does not render EvidenciaArchivo for a DECLARACION requisito', () => {
    vi.mocked(useLegajo).mockReturnValue({
      data: buildLegajo([BASE_REQUISITO]),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useLegajo>);

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.queryByTestId('evidencia-archivo')).not.toBeInTheDocument();
  });

  it('does not render EvidenciaArchivo for a FALTANTE FOTO requisito with no objectKey yet', () => {
    vi.mocked(useLegajo).mockReturnValue({
      data: buildLegajo([
        {
          ...BASE_REQUISITO,
          requisito: 'CONDICIONES_SANITARIAS_ADECUADAS',
          estado: 'FALTANTE',
          tipoEvidencia: null,
          declaracion: null,
          objectKey: null,
        },
      ]),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useLegajo>);

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.queryByTestId('evidencia-archivo')).not.toBeInTheDocument();
  });
});

function mockLegajo(data: LegajoResponse) {
  vi.mocked(useLegajo).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useLegajo>);
}

const N1_FALTANTE = {
  ...BASE_REQUISITO,
  requisito: 'SERVICIO_REGULAR_GRATUITO' as const,
  estado: 'FALTANTE' as const,
  tipoEvidencia: null,
  declaracion: null,
};
const N2_FALTANTE = {
  ...N1_FALTANTE,
  requisito: 'CONDICIONES_SANITARIAS_ADECUADAS' as const,
  nivelExigido: 'N2' as const,
};
const N2_FALTANTE_B = {
  ...N2_FALTANTE,
  requisito: 'SIN_KIOSCO_MISMO_DOMICILIO' as const,
};
const N3_FALTANTE = {
  ...N1_FALTANTE,
  requisito: 'ACEPTA_AUDITORIAS_SIN_AVISO' as const,
  nivelExigido: 'N3' as const,
};

describe('AcreditacionPage — guidance by nivel', () => {
  beforeEach(() => {
    vi.mocked(useMisOrganizaciones).mockReturnValue({
      data: [ORGANIZACION],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMisOrganizaciones>);
  });

  it('highlights the next nivel and locks the ones above it', async () => {
    const user = userEvent.setup();
    mockLegajo(buildLegajo([N1_FALTANTE, N2_FALTANTE, N3_FALTANTE], 'N0'));

    render(<AcreditacionPage />, { wrapper: Wrapper });

    const n1 = screen.getByRole('heading', { name: 'N1 · Identificada' }).closest('section')!;
    const n2 = screen.getByRole('heading', { name: 'N2 · Operativa' }).closest('section')!;
    const n3 = screen.getByRole('heading', { name: 'N3 · Acreditada' }).closest('section')!;

    expect(within(n1).getByText('PRÓXIMO NIVEL')).toBeInTheDocument();
    expect(within(n1).getByRole('button', { name: 'Enviar evidencia' })).toBeInTheDocument();

    expect(within(n2).getByText('1 requisito · se habilita cuando alcances N1')).toBeInTheDocument();
    expect(within(n3).getByText('1 requisito · se habilita cuando alcances N2')).toBeInTheDocument();

    // Locked levels stay collapsed until asked, and their list is read-only.
    expect(within(n2).queryByText('Condiciones sanitarias adecuadas')).not.toBeInTheDocument();
    await user.click(within(n2).getByRole('button', { name: 'Ver requisitos' }));
    expect(within(n2).getByText('Condiciones sanitarias adecuadas')).toBeInTheDocument();
    expect(within(n2).queryByRole('button', { name: /enviar|reenviar/i })).not.toBeInTheDocument();
  });

  it('shows the escalera de niveles with what each nivel means and how to climb', () => {
    mockLegajo(buildLegajo([N1_FALTANTE, N2_FALTANTE], 'N0'));

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByRole('heading', { name: 'Escalera de niveles' })).toBeInTheDocument();
    expect(
      screen.getByText('Estás acá. Tu organización existe, pero todavía no aparece en el mapa.'),
    ).toBeInTheDocument();
    expect(screen.getByText('N1 · IDENTIFICADA — PRÓXIMO')).toBeInTheDocument();
    expect(screen.getByText('N2 · OPERATIVA')).toBeInTheDocument();
    expect(screen.getByText('Aparecés en el mapa y podés tener hasta 3 necesidades abiertas.')).toBeInTheDocument();
    expect(screen.getByText('Hasta 6 necesidades; suma refrigerados y congelados.')).toBeInTheDocument();
    expect(screen.getByText('Hasta 12 necesidades abiertas.')).toBeInTheDocument();
    expect(screen.getByText(/Cómo se sube: cargás evidencia por requisito/)).toBeInTheDocument();
  });

  it('fills the next nivel bar by approved ratio and the reached ones fully', () => {
    mockLegajo(
      buildLegajo(
        [
          { ...N1_FALTANTE, estado: 'APROBADA' },
          { ...N2_FALTANTE, estado: 'APROBADA' },
          N2_FALTANTE_B,
        ],
        'N1',
      ),
    );

    render(<AcreditacionPage />, { wrapper: Wrapper });

    const bar = (nivel: string) =>
      within(document.querySelector(`[data-nivel="${nivel}"]`) as HTMLElement).getByRole('progressbar');
    expect(bar('N0')).toHaveAttribute('aria-valuenow', '100');
    expect(bar('N1')).toHaveAttribute('aria-valuenow', '100');
    expect(bar('N2')).toHaveAttribute('aria-valuenow', '50');
    expect(bar('N3')).toHaveAttribute('aria-valuenow', '0');
  });

  it('collapses a fully approved reached nivel and lets the user expand it', async () => {
    const user = userEvent.setup();
    mockLegajo(
      buildLegajo([{ ...N1_FALTANTE, estado: 'APROBADA' }, N2_FALTANTE], 'N1'),
    );

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByText('Completado')).toBeInTheDocument();
    expect(screen.queryByText('Servicio regular y gratuito')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver requisitos' }));
    expect(screen.getByText('Servicio regular y gratuito')).toBeInTheDocument();
  });

  it('shows the progress of each nivel as "X de Y requisitos aprobados"', () => {
    mockLegajo(
      buildLegajo(
        [
          { ...N1_FALTANTE, estado: 'APROBADA' },
          { ...N1_FALTANTE, requisito: 'NO_DISCRIMINACION' },
          { ...N1_FALTANTE, requisito: 'SEDE_INSCRIPTA_INDIVIDUALMENTE' },
        ],
        'N0',
      ),
    );

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByText('1 de 3 requisitos aprobados')).toBeInTheDocument();
    expect(screen.queryByText(/Completaste los requisitos de N1/)).not.toBeInTheDocument();
  });

  it('shows the ready-for-review callout when every next-nivel requisito is approved', () => {
    mockLegajo(
      buildLegajo(
        [
          { ...N1_FALTANTE, estado: 'APROBADA' },
          { ...N1_FALTANTE, requisito: 'NO_DISCRIMINACION', estado: 'APROBADA' },
          { ...N1_FALTANTE, requisito: 'SEDE_INSCRIPTA_INDIVIDUALMENTE', estado: 'APROBADA' },
        ],
        'N0',
      ),
    );

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByText('Completaste los requisitos de N1')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Los 3 requisitos están aprobados. Un administrador va a revisar tu legajo y subir tu nivel.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('3 de 3 requisitos aprobados')).toBeInTheDocument();
  });

  it('does not count an expired approved requisito as approved', () => {
    mockLegajo(
      buildLegajo([{ ...N1_FALTANTE, estado: 'APROBADA', expirada: true }], 'N0'),
    );

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByText('0 de 1 requisitos aprobados')).toBeInTheDocument();
    expect(screen.getByText('Vencida')).toBeInTheDocument();
    expect(screen.queryByText(/Completaste los requisitos/)).not.toBeInTheDocument();
  });

  it('shows a VENCIDA requisito as Vencida with the grace deadline and a renew action', () => {
    mockLegajo(
      buildLegajo(
        [{ ...N1_FALTANTE, estado: 'VENCIDA', expirada: true, validoHasta: '2026-10-01', graciaHasta: '2026-10-31', graciaVencida: false }],
        'N1',
      ),
    );

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByText('Vencida')).toBeInTheDocument();
    expect(screen.getByText(/Venció el 01\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/hasta el 31\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /renovar evidencia/i })).toBeInTheDocument();
    expect(screen.getByText('0 de 1 requisitos aprobados')).toBeInTheDocument();
  });

  it('treats a stored VENCIDA state as expired even if the date alone does not say so', () => {
    mockLegajo(buildLegajo([{ ...N1_FALTANTE, estado: 'VENCIDA', expirada: false }], 'N1'));

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByText('Vencida')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /renovar evidencia/i })).toBeInTheDocument();
  });

  it('tells the referente the grace period is over once it is', () => {
    mockLegajo(
      buildLegajo(
        [{ ...N1_FALTANTE, estado: 'VENCIDA', expirada: true, validoHasta: '2026-09-01', graciaHasta: '2026-10-01', graciaVencida: true }],
        'N1',
      ),
    );

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByText(/terminó el plazo de gracia/i)).toBeInTheDocument();
  });

  it.each([
    ['FALTANTE', 'Sin enviar'],
    ['PENDIENTE', 'Pendiente de auditoría'],
    ['APROBADA', 'Aprobada'],
    ['OBSERVADA', 'Observada'],
  ] as const)('shows a visible estado badge for %s', (estado, label) => {
    mockLegajo(buildLegajo([{ ...N1_FALTANTE, estado }], 'N0'));

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it('offers no form entry point for PENDIENTE or APROBADA requisitos', () => {
    mockLegajo(
      buildLegajo(
        [
          { ...N1_FALTANTE, estado: 'PENDIENTE' },
          { ...N1_FALTANTE, requisito: 'NO_DISCRIMINACION', estado: 'APROBADA' },
        ],
        'N0',
      ),
    );

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.queryByRole('button', { name: /enviar|reenviar|reemplazar/i })).not.toBeInTheDocument();
  });

  it('closes the form and confirms on the card after a successful submit', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({
      data: { id: 1, organizacionId: 5, requisito: 'SERVICIO_REGULAR_GRATUITO', tipoEvidencia: 'DECLARACION', estado: 'PENDIENTE' },
    });
    mockLegajo(buildLegajo([N1_FALTANTE], 'N0'));

    render(<AcreditacionPage />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button', { name: 'Enviar evidencia' }));
    await user.type(
      screen.getByLabelText('Declaración', { selector: 'textarea' }),
      'Servimos lunes a viernes',
    );
    await user.click(screen.getByRole('button', { name: 'Enviar a auditoría' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Evidencia enviada. Un administrador la va a revisar.',
    );
    expect(screen.queryByLabelText('Declaración', { selector: 'textarea' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Pendiente de auditoría').length).toBeGreaterThan(0);
    // Nothing left to submit until an admin decides.
    expect(screen.queryByRole('button', { name: /enviar evidencia/i })).not.toBeInTheDocument();
  });

  it('cancelling the form closes it without sending', async () => {
    const user = userEvent.setup();
    mockLegajo(buildLegajo([N1_FALTANTE], 'N0'));

    render(<AcreditacionPage />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button', { name: 'Enviar evidencia' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('radio', { name: 'Foto' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar evidencia' })).toBeInTheDocument();
  });

  it('shows what the administrator asked for on an OBSERVADA requisito', () => {
    mockLegajo(
      buildLegajo(
        [{ ...N1_FALTANTE, estado: 'OBSERVADA', observacion: 'La foto está borrosa, subí otra.' }],
        'N0',
      ),
    );

    render(<AcreditacionPage />, { wrapper: Wrapper });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Qué pidió el administrador');
    expect(alert).toHaveTextContent('La foto está borrosa, subí otra.');
    expect(screen.getByRole('button', { name: 'Reenviar evidencia' })).toBeInTheDocument();
  });

  it('falls back to a generic message when the observación is missing', () => {
    mockLegajo(buildLegajo([{ ...N1_FALTANTE, estado: 'OBSERVADA' }], 'N0'));

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByRole('alert')).toHaveTextContent(/observó esta evidencia/);
  });

  it('describes each estado with the dates the legajo carries and omits the ones it does not', () => {
    mockLegajo(
      buildLegajo(
        [
          {
            ...N1_FALTANTE,
            estado: 'APROBADA',
            auditadoEn: '2026-03-05T15:00:00Z',
            validoHasta: '2027-03-05',
          },
          {
            ...N1_FALTANTE,
            requisito: 'NO_DISCRIMINACION',
            estado: 'APROBADA',
            auditadoEn: null,
            validoHasta: null,
          },
          {
            ...N1_FALTANTE,
            requisito: 'SEDE_INSCRIPTA_INDIVIDUALMENTE',
            estado: 'PENDIENTE',
            tipoEvidencia: 'FOTO',
            cargadoEn: '2026-04-02T15:00:00Z',
          },
        ],
        'N0',
      ),
    );

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByText('Aprobada el 05/03 · vigente hasta 05/03/2027')).toBeInTheDocument();
    // Two pills plus the date-less line, which is just the sentence head.
    expect(screen.getAllByText('Aprobada')).toHaveLength(3);
    expect(
      screen.getByText('Foto enviada el 02/04 · un administrador la está revisando'),
    ).toBeInTheDocument();
  });

  it('shows the hint as "Qué cargar" on a FALTANTE requisito', () => {
    mockLegajo(buildLegajo([N1_FALTANTE], 'N0'));

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByText(/^Qué cargar: Una foto del espacio donde sirven la comida/)).toBeInTheDocument();
  });
});

describe('AcreditacionPage — organization selector', () => {
  const OTRA_ORG: Organizacion = { ...ORGANIZACION, id: 9, nombre: 'Merendero Sol' };

  it('is hidden with a single organization', () => {
    vi.mocked(useMisOrganizaciones).mockReturnValue({
      data: [ORGANIZACION],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMisOrganizaciones>);
    mockLegajo(buildLegajo([N1_FALTANTE], 'N0'));

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.queryByLabelText('Organización')).not.toBeInTheDocument();
  });

  it('defaults to the first organization and loads the legajo of the chosen one', async () => {
    const user = userEvent.setup();
    vi.mocked(useMisOrganizaciones).mockReturnValue({
      data: [ORGANIZACION, OTRA_ORG],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMisOrganizaciones>);
    mockLegajo(buildLegajo([N1_FALTANTE], 'N0'));

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(useLegajo).toHaveBeenLastCalledWith(5);
    await user.selectOptions(screen.getByLabelText('Organización'), 'Merendero Sol');
    expect(useLegajo).toHaveBeenLastCalledWith(9);
  });
});
