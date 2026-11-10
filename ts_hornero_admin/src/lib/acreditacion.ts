import { NivelAcreditacion } from '../types/domain';
import type { NivelAcreditacion as NivelAcreditacionType } from '../types/domain';

export interface NivelLadderEntry {
  nivel: NivelAcreditacionType;
  titulo: string;
  descripcion: string;
}

/**
 * Static N0..N3 ladder copy shown by `BienvenidaAcreditacion` (register's
 * "Acreditación" step). Single source of truth for what each level unlocks —
 * see task 1.10: no other screen duplicates this full explanatory copy
 * (`NivelBadge` only reuses the short N0-N3 labels, not these descriptions).
 */
export const NIVEL_LADDER: NivelLadderEntry[] = [
  {
    nivel: NivelAcreditacion.N0,
    titulo: 'N0 · Registrada',
    descripcion:
      'Nivel actual: registro de la organización y su referente. Habilita cargar evidencia; ' +
      'todavía no aparece en el mapa público.',
  },
  {
    nivel: NivelAcreditacion.N1,
    titulo: 'N1 · Identificada',
    descripcion:
      'Siguiente: servicio regular y gratuito, sin discriminación, sede inscripta por separado. ' +
      'Habilita aparecer en el mapa y recibir donaciones no perecederas.',
  },
  {
    nivel: NivelAcreditacion.N2,
    titulo: 'N2 · Operativa',
    descripcion:
      'Condiciones sanitarias adecuadas, sin kiosco en el mismo domicilio, hasta 50 km del Banco ' +
      'de Alimentos. Habilita recibir donaciones refrigeradas y congeladas.',
  },
  {
    nivel: NivelAcreditacion.N3,
    titulo: 'N3 · Acreditada',
    descripcion:
      'Personería jurídica o aval, acepta auditorías sin aviso. Máximo nivel de confianza de la ' +
      'plataforma.',
  },
];

const REQUISITO_LABELS: Record<string, string> = {
  SERVICIO_REGULAR_GRATUITO: 'Servicio regular y gratuito',
  NO_DISCRIMINACION: 'Sin discriminación',
  SEDE_INSCRIPTA_INDIVIDUALMENTE: 'Sede inscripta individualmente',
  CONDICIONES_SANITARIAS_ADECUADAS: 'Condiciones sanitarias adecuadas',
  SIN_KIOSCO_MISMO_DOMICILIO: 'Sin kiosco en el mismo domicilio',
  RADIO_50KM_BANCO_ALIMENTOS: 'Hasta 50 km del Banco de Alimentos',
  PERSONERIA_JURIDICA_O_AVAL: 'Personería jurídica o aval',
  ACEPTA_AUDITORIAS_SIN_AVISO: 'Acepta auditorías sin aviso',
};

/** Human Spanish label for a requisito code; unknown codes fall back to the raw code. */
export function requisitoLabel(codigo: string): string {
  return REQUISITO_LABELS[codigo] ?? codigo;
}

const REQUISITO_HINTS: Record<string, string> = {
  SERVICIO_REGULAR_GRATUITO:
    'Una foto del espacio donde sirven la comida o una declaración de los días y horarios.',
  NO_DISCRIMINACION:
    'Una declaración en la que expliques que atienden a todas las personas sin distinción.',
  SEDE_INSCRIPTA_INDIVIDUALMENTE:
    'Un documento o una declaración que muestre que esta sede está inscripta por separado.',
  CONDICIONES_SANITARIAS_ADECUADAS:
    'Fotos de la cocina y del lugar de almacenamiento, o un certificado sanitario.',
  SIN_KIOSCO_MISMO_DOMICILIO:
    'Una declaración o una foto del frente que muestre que en el domicilio no funciona un kiosco.',
  RADIO_50KM_BANCO_ALIMENTOS:
    'Una declaración con la dirección de tu sede y el Banco de Alimentos más cercano.',
  PERSONERIA_JURIDICA_O_AVAL:
    'El documento de personería jurídica o una carta de aval de otra organización.',
  ACEPTA_AUDITORIAS_SIN_AVISO:
    'Una declaración en la que aceptes recibir visitas de auditoría sin aviso previo.',
};

/** Plain-Spanish hint about the proof expected for a requisito; empty for unknown codes. */
export function requisitoHint(codigo: string): string {
  return REQUISITO_HINTS[codigo] ?? '';
}

export type NivelRequisitos = 'N1' | 'N2' | 'N3';

export const NIVELES_REQUISITOS: NivelRequisitos[] = ['N1', 'N2', 'N3'];

/** Position of a nivel on the N0..N3 ladder. */
export function nivelRank(nivel: string): number {
  return ['N0', 'N1', 'N2', 'N3'].indexOf(nivel);
}

/** One-line meaning of each nivel on the referente's "Escalera de niveles". */
export const NIVEL_SIGNIFICADO: Record<NivelAcreditacionType, string> = {
  N0: 'Tu organización existe, pero todavía no aparece en el mapa.',
  N1: 'Aparecés en el mapa y podés tener hasta 3 necesidades abiertas.',
  N2: 'Hasta 6 necesidades; suma refrigerados y congelados.',
  N3: 'Hasta 12 necesidades abiertas.',
};

/** "N1 · Identificada" title of a nivel (from the shared ladder copy). */
export function nivelTitulo(nivel: string): string {
  return NIVEL_LADDER.find((n) => n.nivel === nivel)?.titulo ?? nivel;
}

/** Calendar date (`YYYY-MM-DD`) or instant (ISO timestamp) -> `dd/mm`, or `null` if unparsable. */
export function formatDiaMes(valor: string | null | undefined): string | null {
  const f = partesFecha(valor);
  return f ? `${f.dd}/${f.mm}` : null;
}

/** Calendar date or instant -> `dd/mm/aaaa`, or `null` if unparsable. */
export function formatFechaCompleta(valor: string | null | undefined): string | null {
  const f = partesFecha(valor);
  return f ? `${f.dd}/${f.mm}/${f.yyyy}` : null;
}

function partesFecha(valor: string | null | undefined) {
  if (!valor) return null;
  // A bare LocalDate must not go through Date (UTC midnight shifts to the previous local day).
  const solo = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (solo) return { yyyy: solo[1], mm: solo[2], dd: solo[3] };
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return {
    yyyy: String(d.getFullYear()),
    mm: String(d.getMonth() + 1).padStart(2, '0'),
    dd: String(d.getDate()).padStart(2, '0'),
  };
}

/** Largest evidence file the BFF accepts (`upload.module.ts`). */
export const MAX_EVIDENCIA_BYTES = 5 * 1024 * 1024;

/** `1,2 MB` / `340 KB` style size for the file preview. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
