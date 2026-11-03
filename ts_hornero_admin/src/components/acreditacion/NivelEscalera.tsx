import { InfoCircle } from 'iconsax-reactjs';
import { Card } from '../ui/Card';
import { Text } from '../ui/Typography';
import { NIVEL_SIGNIFICADO, nivelRank, nivelTitulo } from '../../lib/acreditacion';
import type { NivelAcreditacion, RequisitoEnLegajo } from '../../types/domain';

const NIVELES: NivelAcreditacion[] = ['N0', 'N1', 'N2', 'N3'];

interface NivelEscaleraProps {
  nivelActual: NivelAcreditacion;
  requisitos: RequisitoEnLegajo[];
}

/** Share of a nivel's requisitos that are approved and not expired (0 when it has none). */
function ratioAprobados(requisitos: RequisitoEnLegajo[], nivel: string): number {
  const delNivel = requisitos.filter((r) => r.nivelExigido === nivel);
  if (delNivel.length === 0) return 0;
  return delNivel.filter((r) => r.estado === 'APROBADA' && !r.expirada).length / delNivel.length;
}

/**
 * "Escalera de niveles": N0..N3 side by side. Reached levels get a solid bar, the next level a
 * track filled by its approved-requisitos ratio, future levels an empty track. Wraps to 2 / 1
 * columns on narrow widths without media queries.
 */
export function NivelEscalera({ nivelActual, requisitos }: NivelEscaleraProps) {
  const actual = nivelRank(nivelActual);

  return (
    <Card as="section" style={{ padding: 16 }}>
      <Text as="h2" variant="title">Escalera de niveles</Text>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 16,
          marginTop: 12,
        }}
      >
        {NIVELES.map((nivel) => {
          const rank = nivelRank(nivel);
          const estado = rank <= actual ? 'alcanzado' : rank === actual + 1 ? 'proximo' : 'futuro';
          const fill = estado === 'alcanzado' ? 1 : estado === 'proximo' ? ratioAprobados(requisitos, nivel) : 0;
          const color =
            estado === 'alcanzado' ? 'var(--ok)' : estado === 'proximo' ? 'var(--horn)' : 'var(--ink-3)';
          const label = `${nivelTitulo(nivel).toUpperCase()}${estado === 'proximo' ? ' — PRÓXIMO' : ''}`;
          const esActual = rank === actual;

          return (
            <div key={nivel} data-nivel={nivel} data-estado={estado}>
              <div
                role="progressbar"
                aria-label={`Progreso de ${nivel}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(fill * 100)}
                style={{ height: 6, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}
              >
                <div style={{ width: `${fill * 100}%`, height: '100%', background: color }} />
              </div>
              <Text variant="caption" style={{ marginTop: 8, color, letterSpacing: '0.04em' }}>
                {label}
              </Text>
              <Text variant="body-sm" color="ink-2" style={{ marginTop: 2 }}>
                {esActual ? 'Estás acá. ' : ''}
                {NIVEL_SIGNIFICADO[nivel]}
              </Text>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          marginTop: 16,
          padding: '10px 12px',
          borderRadius: 'var(--r-input)',
          background: 'var(--card-2)',
        }}
      >
        <InfoCircle size={20} variant="Bold" color="var(--sky-tx)" aria-hidden="true" style={{ flexShrink: 0 }} />
        <Text variant="body-sm" color="ink-2">
          Cómo se sube: cargás evidencia por requisito, un administrador la audita y, cuando todos
          los del nivel están aprobados, revisa tu legajo y sube el nivel.
        </Text>
      </div>
    </Card>
  );
}
