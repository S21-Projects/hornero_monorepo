import { useMisDonaciones } from '../lib/hooks/useMisDonaciones';
import { ESTADO_DONACION, FALLBACK_BADGE } from '../lib/domain-ui';
import { formatFecha } from '../lib/format';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Typography';

export default function MisDonacionesPage() {
  const { data: donaciones, isLoading, isError } = useMisDonaciones();

  return (
    <div style={{ maxWidth: 720 }}>
      <Text variant="h2" style={{ marginBottom: 24 }}>Mis donaciones</Text>

      <AsyncSection
        isLoading={isLoading}
        isError={isError}
        isEmpty={!isLoading && !isError && (donaciones ?? []).length === 0}
        emptyLabel="Aún no realizaste donaciones."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(donaciones ?? []).map((d) => {
            const estadoCfg = ESTADO_DONACION[d.estado] ?? FALLBACK_BADGE;
            return (
              <Card key={d.id} as="article" style={{ padding: '20px 24px' }}>
                <div style={{ marginBottom: 10 }}>
                  <Badge tone={estadoCfg.tone} label={estadoCfg.label} />
                </div>

                {d.fechaOferta && (
                  <Text variant="body-sm" color="ink-2" style={{ marginBottom: 2 }}>
                    Ofrecida: {formatFecha(d.fechaOferta)}
                  </Text>
                )}
                {d.fechaEntrega && (
                  <Text variant="body-sm" color="ink-2" style={{ marginBottom: 2 }}>
                    Entregada: {formatFecha(d.fechaEntrega)}
                  </Text>
                )}
                {d.observaciones && (
                  <Text variant="caption" color="ink-3" style={{ display: 'block', marginTop: 6 }}>
                    {d.observaciones}
                  </Text>
                )}
              </Card>
            );
          })}
        </div>
      </AsyncSection>
    </div>
  );
}
