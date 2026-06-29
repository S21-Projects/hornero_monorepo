import { Link } from 'react-router-dom';
import { useNecesidades } from '../lib/hooks/useNecesidades';
import { useOrgNombre } from '../lib/hooks/useOrgNombre';
import { PRIORIDAD, FALLBACK_BADGE } from '../lib/domain-ui';
import { formatFecha } from '../lib/format';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Typography';

export default function ExplorarPage() {
  const { data: necesidades, isLoading, isError } = useNecesidades();
  const { getNombre } = useOrgNombre();

  const abiertas = (necesidades ?? []).filter((n) => n.estado === 'ABIERTA');

  return (
    <div style={{ maxWidth: 720 }}>
      <Text variant="h2" style={{ marginBottom: 24 }}>Explorar necesidades</Text>

      <AsyncSection
        isLoading={isLoading}
        isError={isError}
        isEmpty={!isLoading && !isError && abiertas.length === 0}
        emptyLabel="No hay necesidades abiertas en este momento."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {abiertas.map((n) => {
            const prioridadCfg = PRIORIDAD[n.prioridad] ?? FALLBACK_BADGE;
            return (
              <Card key={n.id} as="article" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <Badge tone={prioridadCfg.tone} label={prioridadCfg.label} />
                </div>
                <Text variant="title" style={{ marginBottom: 6 }}>{n.descripcion}</Text>
                <Text variant="body-sm" color="ink-2" style={{ marginBottom: 4 }}>
                  {getNombre(n.organizacionId)}
                </Text>
                {n.fechaVencimiento && (
                  <Text variant="caption" color="ink-3" style={{ marginBottom: 12 }}>
                    Vence: {formatFecha(n.fechaVencimiento)}
                  </Text>
                )}
                <div>
                  <Link
                    to={`/necesidades/${n.id}`}
                    style={{
                      color: 'var(--horn)',
                      fontWeight: 600,
                      fontSize: 'var(--fs-body-sm)',
                      textDecoration: 'none',
                    }}
                  >
                    Ver detalle →
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </AsyncSection>
    </div>
  );
}
