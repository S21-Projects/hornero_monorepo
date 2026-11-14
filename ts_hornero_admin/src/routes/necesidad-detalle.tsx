import { useParams, Link } from 'react-router-dom';
import { useNecesidad } from '../lib/hooks/useNecesidad';
import { PRIORIDAD, ESTADO_NECESIDAD, CATEGORIA_ALIMENTO, UNIDAD_ARTICULO, FALLBACK_BADGE } from '../lib/domain-ui';
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

  // Detect 404: axios throws with response.status 404
  const isNotFound =
    isError &&
    (error as { response?: { status?: number } })?.response?.status === 404;

  const abierta = necesidad?.estado === 'ABIERTA' || necesidad?.estado === 'EN_PROGRESO';
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

            {/* Single creation path: the direct-donation wizard, entered at step 2 */}
            {abierta && (
              <Card as="section" className="card-pad">
                <Text variant="h3" style={{ marginBottom: 8 }}>Ofrecer donación</Text>
                <Text variant="body-sm" color="ink-2" as="p" style={{ marginBottom: 16 }}>
                  Elegí qué artículos y cantidades querés donar a esta necesidad.
                </Text>
                <Link to={`/donar/directa?necesidad=${necesidad.id}`}>
                  <Button type="button" variant="primary" size="sm">Donar a esta necesidad</Button>
                </Link>
              </Card>
            )}
          </>
        )}
      </AsyncSection>
    </div>
  );
}
