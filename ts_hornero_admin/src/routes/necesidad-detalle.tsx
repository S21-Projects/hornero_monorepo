import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNecesidad } from '../lib/hooks/useNecesidad';
import { useCrearDonacion } from '../lib/hooks/useCrearDonacion';
import { mapDonacionError } from '../lib/hooks/mapDonacionError';
import { LineaArticuloEditor } from '../components/donacion/LineaArticuloEditor';
import { PRIORIDAD, ESTADO_NECESIDAD, CATEGORIA_ALIMENTO, UNIDAD_ARTICULO, FALLBACK_BADGE } from '../lib/domain-ui';
import { formatFecha } from '../lib/format';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import type { DonacionLineaInput } from '../types/domain';

export default function NecesidadDetallePage() {
  const { id } = useParams<{ id: string }>();
  const numId = id ? Number(id) : undefined;

  const { data: necesidad, isLoading, isError, error } = useNecesidad(numId);
  const mutation = useCrearDonacion();

  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState<DonacionLineaInput[]>([]);

  // Detect 404: axios throws with response.status 404
  const isNotFound =
    isError &&
    (error as { response?: { status?: number } })?.response?.status === 404;

  const donacionErrorReason = (mutation.error as { response?: { data?: { message?: string } } })
    ?.response?.data?.message;
  const donacionEmailNoVerificado = donacionErrorReason === 'EMAIL_NO_VERIFICADO';

  // Work unit G: restrict the línea picker to what this necesidad actually requests, so every
  // submitted línea is guaranteed compatible — the MS still enforces ARTICULO_INCOMPATIBLE
  // server-side for any stale/race case (decision 6). A pre-catalog necesidad with no articulos
  // leaves the picker unrestricted rather than impossible to donate to.
  const articulosPermitidosIds = necesidad?.articulos?.length ? necesidad.articulos.map((a) => a.id) : undefined;
  const abierta = necesidad?.estado === 'ABIERTA' || necesidad?.estado === 'EN_PROGRESO';
  const lineasValidas = lineas.length > 0 && lineas.every((l) => l.articuloId > 0 && l.cantidad > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numId || !lineasValidas) return;
    mutation.mutate({ necesidadId: numId, lineas, observaciones: observaciones || undefined });
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
                Organización: {necesidad.organizacionNombre ?? 'Organización'}
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

              {necesidad.articulos && necesidad.articulos.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Text variant="caption" color="ink-3" style={{ display: 'block', marginBottom: 6 }}>
                    Artículos solicitados:
                  </Text>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {necesidad.articulos.map((a) => (
                      <Badge
                        key={a.id}
                        tone={CATEGORIA_ALIMENTO[a.categoria]?.tone ?? 'neutral'}
                        label={`${a.nombre} (${UNIDAD_ARTICULO[a.unidad]})`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {!abierta && (
              <Card style={{ padding: '20px 24px' }}>
                <Text variant="body" color="ink-3">
                  Esta necesidad {necesidad.estado === 'VENCIDA' ? 'está vencida' : 'está cerrada'} y ya no recibe donaciones.
                </Text>
              </Card>
            )}

            {/* Donation form — hidden when mutation succeeded or the necesidad is closed */}
            {abierta && !mutation.isSuccess && (
              <Card as="section" style={{ padding: '24px 28px' }}>
                <Text variant="h3" style={{ marginBottom: 16 }}>Ofrecer donación</Text>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <Text variant="label" as="p" style={{ marginBottom: 6 }}>Artículos que ofrecés</Text>
                    <LineaArticuloEditor
                      lineas={lineas}
                      onChange={setLineas}
                      articulosPermitidosIds={articulosPermitidosIds}
                    />
                  </div>

                  <div>
                    <Text variant="label" as="label" style={{ display: 'block', marginBottom: 6 }}>
                      Notas (opcional)
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

                  {mutation.isError && donacionEmailNoVerificado && (
                    <Text variant="body-sm" color="urgent">
                      Todavía no validaste tu cuenta.{' '}
                      <Link to="/verify-email" style={{ color: 'inherit', textDecoration: 'underline' }}>
                        Verificá tu email
                      </Link>{' '}
                      para poder ofrecer donaciones.
                    </Text>
                  )}
                  {mutation.isError && !donacionEmailNoVerificado && (
                    <Text variant="body-sm" color="urgent">
                      {mapDonacionError(mutation.error)}
                    </Text>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    loading={mutation.isPending}
                    disabled={mutation.isPending || !lineasValidas}
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
