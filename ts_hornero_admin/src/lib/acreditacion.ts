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
