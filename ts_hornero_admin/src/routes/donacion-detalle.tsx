import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Typography';
import { DesgloseScore } from '../components/donacion/DesgloseScore';
import { ProgresoDonacion } from '../components/donacion/ProgresoDonacion';
import { useCancelarConConfirmacion } from '../components/donacion/useCancelarConConfirmacion';
import { useAsignaciones } from '../lib/hooks/useAsignaciones';
import { useDonacion } from '../lib/hooks/useDonacion';
import { ESTADO_DONACION, FALLBACK_BADGE, MODALIDAD_DONACION } from '../lib/domain-ui';
import { faseDe, proximoPaso, puedeCancelar, puedeConfirmar } from '../lib/donacion-donante';
import { formatDecimal, formatFecha, formatLineas } from '../lib/format';
import type { AsignacionHistorial } from '../types/domain';

/** Timeline wording per assignment state; the organization name comes from the row itself. */
const EVENTO_ASIGNACION: Record<AsignacionHistorial['estado'], (org: string) => string> = {
  PROPUESTA: (org) => `Propuesta a ${org}`,
  ACEPTADA: (org) => `${org} aceptó la donación`,
  RECHAZADA: (org) => `${org} rechazó la donación`,
  CANCELADA: (org) => `Asignación a ${org} cancelada`,
};

/** Success banner copy: only FONDO_COMUN waits for a ronda; DIRECTA waits for the organización's answer. */
function mensajeNueva(modalidad: string | undefined, asignada: boolean): string {
  if (!modalidad) return 'Donación registrada.';
  if (modalidad === 'FONDO_COMUN') {
    return `Donación registrada. ${asignada ? 'Ya fue asignada.' : 'Va a entrar a la próxima ronda.'}`;
  }
  return 'Donación registrada. La organización tiene que aceptarla; te avisamos cuando responda.';
}

/**
 * `/mis-donaciones/:id` (DONANTE) — donación progress and assignment detail: header with badges
 * and cancel, "Próximo paso" card, progress strip (`ProgresoDonacion`), articles + destination,
 * "¿Por qué este destino?" (`DesgloseScore`) as an aside, and the assignment history as a
 * timeline. `?nueva=1` (set by `nueva-donacion.tsx` right after submitting a `FONDO_COMUN`
 * donación) shows a success banner.
 */
export default function DonacionDetallePage() {
  const { id } = useParams<{ id: string }>();
  const donacionId = id ? Number(id) : undefined;
  const [searchParams] = useSearchParams();
  const esNueva = searchParams.get('nueva') === '1';

  const donacion = useDonacion(donacionId);
  const asignaciones = useAsignaciones(donacionId);
  const cancelar = useCancelarConConfirmacion(donacionId ?? -1);

  const d = donacion.data;
  const historial = asignaciones.data ?? [];
  // History is append-only (newest ronda last) — the most recent row is the current assignment.
  const vigente = historial.length > 0 ? historial[historial.length - 1] : undefined;
  const cronologia = [...historial].reverse();

  const estadoCfg = d ? (ESTADO_DONACION[d.estado] ?? FALLBACK_BADGE) : FALLBACK_BADGE;
  const modalidadCfg = d?.modalidad ? (MODALIDAD_DONACION[d.modalidad] ?? FALLBACK_BADGE) : undefined;
  const destino = vigente?.organizacionNombre ?? d?.organizacionNombre;
  const articulos = d?.lineas && d.lineas.length > 0 ? formatLineas(d.lineas) : undefined;
  const titulo = articulos ? (destino ? `${articulos} para ${destino}` : articulos) : `Donación #${donacionId}`;
  const paso = d ? proximoPaso(d) : undefined;

  return (
    <div className="detail-page">
      <Link to="/mis-donaciones" className="detail-page__back">← Mis donaciones</Link>

      {esNueva && (
        <Card className="banner-ok">
          <Text variant="body-sm" className="banner-ok__text">{mensajeNueva(d?.modalidad, Boolean(vigente))}</Text>
        </Card>
      )}

      <AsyncSection
        isLoading={donacion.isLoading || asignaciones.isLoading}
        isError={donacion.isError || asignaciones.isError}
        isEmpty={!donacion.isLoading && !donacion.isError && !d}
        emptyLabel="No se encontró la donación."
      >
        {d && paso && (
          <>
            <header className="detail-header">
              <div className="detail-header__main">
                <div className="list-card__badges">
                  <Badge tone={estadoCfg.tone} label={estadoCfg.label} />
                  {modalidadCfg && <Badge tone={modalidadCfg.tone} label={modalidadCfg.label} />}
                </div>
                <Text variant="h2">{titulo}</Text>
                <Text variant="body-sm" color="ink-3">
                  Donación #{d.id}
                  {vigente ? ` · asignada en la ronda del ${formatFecha(vigente.rondaFecha)}` : ''}
                </Text>
                {cancelar.isError && (
                  <Text variant="micro" color="urgent">No se pudo cancelar la donación. Intentá de nuevo.</Text>
                )}
              </div>
              {puedeCancelar(d) && (
                <Button type="button" variant="secondary" size="sm" disabled={cancelar.isPending} onClick={cancelar.pedir}>
                  Cancelar donación…
                </Button>
              )}
            </header>

            <div className="detail-layout">
              <div className="detail-layout__main">
                <Card as="section" className="card-pad next-step">
                  <Text variant="caption" color="horn" as="p">Próximo paso</Text>
                  <Text variant="h3" style={{ margin: '2px 0 4px' }}>{paso.titulo}</Text>
                  <Text variant="body-sm" color="ink-2" as="p">{paso.texto}</Text>
                  {puedeConfirmar(d) && (
                    <Link to={`/donaciones/${d.id}/entrega`} style={{ textDecoration: 'none', marginTop: 12, display: 'inline-block' }}>
                      <Button type="button" variant="ok" size="sm">Confirmar entrega</Button>
                    </Link>
                  )}
                </Card>

                <Card className="card-pad">
                  <ProgresoDonacion
                    fase={faseDe(d)}
                    fechas={{
                      ofrecida: d.fechaOferta,
                      asignacion: vigente?.rondaFecha,
                      entregada: d.fechaEntrega,
                    }}
                  />
                </Card>

                <Card className="card-pad">
                  <div className="kv-grid">
                    <div>
                      <Text variant="label" as="h3" style={{ marginBottom: 6 }}>Artículos donados</Text>
                      {d.lineas && d.lineas.length > 0 ? (
                        <ul className="plain-list">
                          {d.lineas.map((l) => (
                            <li key={l.articuloId}><Text variant="body-sm" as="span">{formatLineas([l])}</Text></li>
                          ))}
                        </ul>
                      ) : (
                        <Text variant="body-sm" color="ink-2" as="p">—</Text>
                      )}
                    </div>
                    <div>
                      <Text variant="label" as="h3" style={{ marginBottom: 6 }}>Organización destino</Text>
                      {destino ? (
                        <>
                          <Text variant="body-sm" as="p">{destino}</Text>
                          {vigente && vigente.distanciaKm > 0 && (
                            <Text variant="caption" color="ink-3" as="p">
                              A {formatDecimal(vigente.distanciaKm)} km de tu donación
                            </Text>
                          )}
                        </>
                      ) : (
                        <Text variant="body-sm" color="ink-2" as="p">Esperando ronda</Text>
                      )}
                    </div>
                  </div>
                </Card>

                {cronologia.length > 0 && (
                  <Card as="section" className="card-pad">
                    <Text variant="h3" style={{ marginBottom: 12 }}>Historial de asignaciones</Text>
                    <ol className="timeline">
                      {cronologia.map((h) => (
                        <li key={h.id} className="timeline__item">
                          <span className="timeline__dot" aria-hidden="true" />
                          <Text variant="label" color="ink" as="span">
                            {EVENTO_ASIGNACION[h.estado]?.(h.organizacionNombre) ?? h.organizacionNombre}
                          </Text>
                          <Text variant="caption" color="ink-3" as="span">{formatFecha(h.rondaFecha)}</Text>
                        </li>
                      ))}
                    </ol>
                  </Card>
                )}
              </div>

              {vigente && (
                <aside className="detail-layout__aside">
                  <DesgloseScore asignacion={vigente} />
                </aside>
              )}
            </div>

            {cancelar.dialogo}
          </>
        )}
      </AsyncSection>
    </div>
  );
}
