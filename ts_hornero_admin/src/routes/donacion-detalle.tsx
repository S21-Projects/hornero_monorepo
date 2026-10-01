import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Typography';
import { DesgloseScore } from '../components/donacion/DesgloseScore';
import { ProgresoDonacion } from '../components/donacion/ProgresoDonacion';
import { useAsignaciones } from '../lib/hooks/useAsignaciones';
import { useDonacion } from '../lib/hooks/useDonacion';
import { ESTADO_DONACION, FALLBACK_BADGE, MODALIDAD_DONACION } from '../lib/domain-ui';
import { formatFecha } from '../lib/format';

const CONFIRMABLE_ESTADOS = new Set(['ACEPTADA', 'EN_CAMINO', 'PENDIENTE_CONFIRMACION']);

/**
 * `/mis-donaciones/:id` (DONANTE) — donación progress and assignment detail. Composes the
 * design's "Mis donaciones — asignación" mockup: header, modalidad badge, estado pill, progress
 * strip (`ProgresoDonacion`), "¿Por qué este destino?" score breakdown (`DesgloseScore`) for the
 * current assignment, and the full assignment history as a timeline. `?nueva=1` (set by
 * `nueva-donacion.tsx` right after submitting a `FONDO_COMUN` donación) shows a success banner.
 */
export default function DonacionDetallePage() {
  const { id } = useParams<{ id: string }>();
  const donacionId = id ? Number(id) : undefined;
  const [searchParams] = useSearchParams();
  const esNueva = searchParams.get('nueva') === '1';

  const donacion = useDonacion(donacionId);
  const asignaciones = useAsignaciones(donacionId);

  const d = donacion.data;
  const historial = asignaciones.data ?? [];
  // History is append-only (newest ronda last) — the most recent row is the current assignment.
  const vigente = historial.length > 0 ? historial[historial.length - 1] : undefined;

  const estadoCfg = d ? (ESTADO_DONACION[d.estado] ?? FALLBACK_BADGE) : FALLBACK_BADGE;
  const modalidadCfg = d?.modalidad ? (MODALIDAD_DONACION[d.modalidad] ?? FALLBACK_BADGE) : undefined;

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/mis-donaciones" style={{ textDecoration: 'none', color: 'var(--ink-2)' }}>
          ← Volver
        </Link>
      </div>

      {esNueva && (
        <Card style={{ padding: '14px 20px', marginBottom: 16, background: 'var(--ok)' }}>
          <Text variant="body-sm" style={{ color: '#fff' }}>
            Donación registrada. {vigente ? 'Ya fue asignada.' : 'Va a entrar a la próxima ronda.'}
          </Text>
        </Card>
      )}

      <Text variant="h2" style={{ marginBottom: 4 }}>
        Donación #{donacionId}
        {vigente ? ` · asignada en la ronda del ${formatFecha(vigente.rondaFecha)}` : ''}
      </Text>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <Badge tone={estadoCfg.tone} label={estadoCfg.label} />
        {modalidadCfg && <Badge tone={modalidadCfg.tone} label={modalidadCfg.label} />}
      </div>

      <AsyncSection
        isLoading={donacion.isLoading || asignaciones.isLoading}
        isError={donacion.isError || asignaciones.isError}
        isEmpty={!donacion.isLoading && !donacion.isError && !d}
        emptyLabel="No se encontró la donación."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{ padding: '20px 24px' }}>
            <ProgresoDonacion fase={d?.fase ?? 'EN_FONDO'} />
          </Card>

          <Card style={{ padding: '20px 24px' }}>
            <Text variant="label" style={{ marginBottom: 4 }}>Organización destino</Text>
            {vigente ? (
              <Text variant="body" as="p">{vigente.organizacionNombre}</Text>
            ) : (
              <Text variant="body" color="ink-2" as="p">Esperando ronda</Text>
            )}
          </Card>

          {vigente && <DesgloseScore asignacion={vigente} />}

          {historial.length > 0 && (
            <Card style={{ padding: '20px 24px' }}>
              <Text variant="h3" style={{ marginBottom: 12 }}>Historial de asignaciones</Text>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: 0, padding: 0, listStyle: 'none' }}>
                {historial.map((h) => (
                  <li key={h.id}>
                    <Text variant="body-sm" as="p">
                      {formatFecha(h.rondaFecha)} · {h.organizacionNombre} · {h.estado}
                    </Text>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {d && CONFIRMABLE_ESTADOS.has(d.estado) && (
            <Link to={`/donaciones/${donacionId}/entrega`} style={{ textDecoration: 'none' }}>
              <Text variant="label" color="horn" as="span">Confirmar entrega →</Text>
            </Link>
          )}
        </div>
      </AsyncSection>
    </div>
  );
}
