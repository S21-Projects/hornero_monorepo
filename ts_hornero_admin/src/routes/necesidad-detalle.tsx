import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useNecesidad } from '../lib/hooks/useNecesidad';
import { useOrgNombre } from '../lib/hooks/useOrgNombre';
import { useCrearDonacion } from '../lib/hooks/useCrearDonacion';
import { PRIORIDAD, ESTADO_NECESIDAD, FALLBACK_BADGE } from '../lib/domain-ui';
import { formatFecha } from '../lib/format';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Typography';
import { Button } from '../components/ui/Button';

export default function NecesidadDetallePage() {
  const { id } = useParams<{ id: string }>();
  const numId = id ? Number(id) : undefined;

  const { data: necesidad, isLoading, isError, error } = useNecesidad(numId);
  const { getNombre } = useOrgNombre();
  const mutation = useCrearDonacion();

  const [observaciones, setObservaciones] = useState('');

  // Detect 404: axios throws with response.status 404
  const isNotFound =
    isError &&
    (error as { response?: { status?: number } })?.response?.status === 404;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numId) return;
    mutation.mutate({ necesidadId: numId, observaciones: observaciones || undefined });
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <AsyncSection
        isLoading={isLoading}
        isError={isError && !isNotFound}
        isEmpty={isNotFound}
        emptyLabel="Esta necesidad no existe o ya no está disponible."
      >
        {necesidad && (
          <>
            <Card as="section" style={{ padding: '24px 28px', marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <Badge
                  tone={(PRIORIDAD[necesidad.prioridad] ?? FALLBACK_BADGE).tone}
                  label={(PRIORIDAD[necesidad.prioridad] ?? FALLBACK_BADGE).label}
                />
                <Badge
                  tone={(ESTADO_NECESIDAD[necesidad.estado] ?? FALLBACK_BADGE).tone}
                  label={(ESTADO_NECESIDAD[necesidad.estado] ?? FALLBACK_BADGE).label}
                />
              </div>

              <Text variant="h2" style={{ marginBottom: 12 }}>{necesidad.descripcion}</Text>

              <Text variant="body-sm" color="ink-2" style={{ marginBottom: 4 }}>
                Organización: {getNombre(necesidad.organizacionId)}
              </Text>

              {necesidad.fechaPublicacion && (
                <Text variant="caption" color="ink-3" style={{ display: 'block', marginBottom: 2 }}>
                  Publicado: {formatFecha(necesidad.fechaPublicacion)}
                </Text>
              )}
              {necesidad.fechaVencimiento && (
                <Text variant="caption" color="ink-3" style={{ display: 'block' }}>
                  Vence: {formatFecha(necesidad.fechaVencimiento)}
                </Text>
              )}
            </Card>

            {/* Donation form — hidden when mutation succeeded */}
            {!mutation.isSuccess && (
              <Card as="section" style={{ padding: '24px 28px' }}>
                <Text variant="h3" style={{ marginBottom: 16 }}>Ofrecer donación</Text>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <Text variant="label" as="label" style={{ display: 'block', marginBottom: 6 }}>
                      Observaciones (opcional)
                    </Text>
                    <textarea
                      value={observaciones}
                      onChange={(e) => { setObservaciones(e.target.value); }}
                      placeholder="Describí qué podés ofrecer…"
                      rows={3}
                      style={{
                        fontFamily: 'inherit',
                        fontSize: 14.5,
                        color: 'var(--ink)',
                        background: '#fff',
                        border: '1.5px solid var(--line)',
                        borderRadius: 'var(--r-input)',
                        padding: '12px 14px',
                        width: '100%',
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  {mutation.isError && (
                    <Text variant="body-sm" color="urgent">
                      No se pudo registrar la donación. Intentá de nuevo.
                    </Text>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    loading={mutation.isPending}
                    disabled={mutation.isPending}
                    size="sm"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Ofrecer donación
                  </Button>
                </form>
              </Card>
            )}

            {mutation.isSuccess && (
              <Card style={{ padding: '20px 24px', background: 'var(--ok-bg, #e8f5ee)' }}>
                <Text variant="body" color="ok">
                  ¡Donación registrada! Te contactaremos pronto.
                </Text>
              </Card>
            )}
          </>
        )}
      </AsyncSection>
    </div>
  );
}
