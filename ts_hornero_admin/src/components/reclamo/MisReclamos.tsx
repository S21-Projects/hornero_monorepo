import { Badge } from '../Badge';
import { Card } from '../ui/Card';
import { Text } from '../ui/Typography';
import { useMisReclamos } from '../../lib/hooks/useReclamos';
import { ESTADO_RECLAMO } from '../../lib/domain-ui';
import { formatFecha } from '../../lib/format';

/**
 * The referente's own claims and their status. Renders nothing when there are none (or while
 * loading / on error), so the "Mis organizaciones" page is unchanged for referentes who never
 * claimed a comedor.
 */
export function MisReclamos() {
  const { data } = useMisReclamos();
  const reclamos = data ?? [];
  if (reclamos.length === 0) return null;

  return (
    <section aria-labelledby="mis-reclamos-titulo" style={{ marginTop: 32 }}>
      <Text variant="h3" as="h2" id="mis-reclamos-titulo" style={{ marginBottom: 12 }}>
        Mis reclamos
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reclamos.map((r) => {
          const estado = ESTADO_RECLAMO[r.estado] ?? { tone: 'neutral' as const, label: r.estado };
          return (
            <Card key={r.id} style={{ padding: 16 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
              >
                <Text variant="title">{r.organizacionNombre}</Text>
                <Badge tone={estado.tone} label={estado.label} />
              </div>
              <Text variant="body-sm" color="ink-3" style={{ marginTop: 4, display: 'block' }}>
                Enviado el {formatFecha(r.creadoEn)}
              </Text>
              {r.estado === 'PENDIENTE' && (
                <Text variant="body-sm" color="ink-2" style={{ marginTop: 8, display: 'block' }}>
                  Un administrador está revisando tu reclamo.
                </Text>
              )}
              {r.estado === 'APROBADO' && (
                <Text variant="body-sm" color="ink-2" style={{ marginTop: 8, display: 'block' }}>
                  Tenés a cargo este comedor. Un administrador lo validará como a cualquier organización nueva.
                </Text>
              )}
              {r.estado === 'RECHAZADO' && r.motivoRechazo && (
                <Text variant="body-sm" color="urgent" style={{ marginTop: 8, display: 'block' }}>
                  Motivo: {r.motivoRechazo}
                </Text>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
