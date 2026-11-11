import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useNecesidades } from '../lib/hooks/useNecesidades';
import { useNecesidad } from '../lib/hooks/useNecesidad';
import { useCrearDonacion } from '../lib/hooks/useCrearDonacion';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { mapDonacionError } from '../lib/hooks/mapDonacionError';
import { PRIORIDAD } from '../lib/domain-ui';
import { AsyncSection } from '../components/AsyncSection';
import { LineaArticuloEditor } from '../components/donacion/LineaArticuloEditor';
import { NecesidadPickCard } from '../components/donacion/NecesidadPickCard';
import { ResumenDonacion } from '../components/donacion/ResumenDonacion';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Pager } from '../components/ui/Pager';
import { PageHeader } from '../components/ui/PageHeader';
import { Stepper } from '../components/ui/Stepper';
import { Text } from '../components/ui/Typography';
import type { DonacionLineaInput, Necesidad } from '../types/domain';

const PAGE_SIZE = 20;
const STEPS = ['Necesidad', 'Qué donás', 'Confirmar'] as const;
/** Mirrors the MS default of `DONACIONES_OFERTA_SIN_RESPUESTA_DIAS` (direct offers expire after it). */
const DIAS_PARA_ACEPTAR = 7;
const BLANK_LINEA: DonacionLineaInput = { articuloId: 0, cantidad: 1 };

type Paso = 0 | 1 | 2;

/**
 * Direct-donation wizard (`/donar/directa`, DONANTE): 1) pick an open necesidad, 2) choose the
 * artículos/cantidades it requests, 3) add a note and confirm. `?necesidad=<id>` starts at step 2.
 * Entered data lives here, so moving back and forth never loses it.
 */
export default function DonarDirectaPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preId = Number(params.get('necesidad')) || undefined;

  const [paso, setPaso] = useState<Paso>(preId ? 1 : 0);
  const [elegida, setElegida] = useState<Necesidad | null>(null);
  const [lineas, setLineas] = useState<DonacionLineaInput[]>(preId ? [BLANK_LINEA] : []);
  const [observaciones, setObservaciones] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [prioridad, setPrioridad] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const pre = useNecesidad(preId);
  const lista = useNecesidades({ page, size: PAGE_SIZE });
  usePageClamp(page, setPage, lista.data?.totalPages);
  const crear = useCrearDonacion();

  const necesidad = elegida ?? (pre.data && pre.data.id === preId ? pre.data : null);
  const abierta = necesidad?.estado === 'ABIERTA' || necesidad?.estado === 'EN_PROGRESO';
  const lineasValidas = lineas.length > 0 && lineas.every((l) => l.articuloId > 0 && l.cantidad > 0);
  const articulosPermitidosIds = necesidad?.articulos?.length ? necesidad.articulos.map((a) => a.id) : undefined;

  const q = busqueda.trim().toLowerCase();
  const visibles = (lista.data?.content ?? [])
    .filter((n) => n.estado === 'ABIERTA')
    .filter((n) => prioridad === null || n.prioridad === prioridad)
    .filter(
      (n) =>
        !q ||
        [n.descripcion, n.organizacionNombre, ...(n.articulos?.map((a) => a.nombre) ?? [])]
          .filter(Boolean)
          .some((t) => t!.toLowerCase().includes(q)),
    );

  function elegir(n: Necesidad) {
    // Another necesidad requests other artículos, so lines chosen for the previous one are dropped.
    if (necesidad && necesidad.id !== n.id) setLineas([]);
    setElegida(n);
  }

  function continuarAArticulos() {
    if (lineas.length === 0) setLineas([BLANK_LINEA]);
    setPaso(1);
  }

  function confirmar() {
    if (!necesidad || !lineasValidas) return;
    crear.mutate(
      { necesidadId: necesidad.id, lineas, observaciones: observaciones.trim() || undefined },
      { onSuccess: (d) => { navigate(`/mis-donaciones/${d.id}?nueva=1`); } },
    );
  }

  const emailNoVerificado =
    (crear.error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message ===
    'EMAIL_NO_VERIFICADO';

  const cargandoPre = paso > 0 && !necesidad && preId !== undefined && pre.isLoading;

  return (
    <div className="wizard">
      <PageHeader
        title="Donación directa"
        description="Elegí una necesidad, indicá qué donás y confirmá."
      />
      <Stepper steps={STEPS} current={paso} fullWidth />

      {paso === 0 && (
        <section aria-label="Elegir necesidad">
          <div className="field">
            <label htmlFor="busqueda-necesidad">
              <Text variant="label" as="span">Buscar necesidad</Text>
            </label>
            <input
              id="busqueda-necesidad"
              className="field__control"
              type="search"
              placeholder="Organización, artículo o descripción"
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); }}
            />
          </div>
          <div className="wizard-filters" role="group" aria-label="Filtrar por prioridad">
            <button
              type="button"
              className={`chip${prioridad === null ? ' chip--selected' : ''}`}
              aria-pressed={prioridad === null}
              onClick={() => { setPrioridad(null); }}
            >
              Todas
            </button>
            {Object.entries(PRIORIDAD).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                className={`chip${prioridad === key ? ' chip--selected' : ''}`}
                aria-pressed={prioridad === key}
                onClick={() => { setPrioridad(key); }}
              >
                {cfg.label}
              </button>
            ))}
          </div>

          <AsyncSection
            isLoading={lista.isLoading}
            isError={lista.isError}
            isEmpty={!lista.isLoading && !lista.isError && (lista.data?.content.length ?? 0) === 0}
            emptyLabel="No hay necesidades abiertas en este momento."
          >
            <div className="stack" role="radiogroup" aria-label="Necesidades abiertas">
              {visibles.map((n) => (
                <NecesidadPickCard key={n.id} necesidad={n} checked={necesidad?.id === n.id} onSelect={elegir} />
              ))}
            </div>
            {visibles.length === 0 && (
              <Text variant="body-sm" color="ink-2">
                Ninguna necesidad coincide con tu búsqueda en esta página.
              </Text>
            )}
            {lista.data && <Pager page={lista.data} onPageChange={setPage} disabled={lista.isFetching} />}
          </AsyncSection>

          <div className="wizard-bar">
            <Text variant="body-sm" className="wizard-bar__text">
              {necesidad ? (
                <>Elegiste: <strong>{necesidad.organizacionNombre ?? 'Organización'}</strong> — {necesidad.descripcion}</>
              ) : (
                <>
                  Elegí una necesidad o{' '}
                  <Link to="/donar?modalidad=fondo-comun">doná al fondo común</Link>.
                </>
              )}
            </Text>
            <Button type="button" variant="primary" disabled={!necesidad || !abierta} onClick={continuarAArticulos}>
              Continuar
            </Button>
          </div>
        </section>
      )}

      {paso > 0 && cargandoPre && <Text variant="body" color="ink-3">Cargando…</Text>}

      {paso > 0 && !cargandoPre && (!necesidad || !abierta) && (
        <Card className="card-pad">
          <Text variant="body" color="ink-2" as="p">
            Esta necesidad no existe o ya no recibe donaciones.
          </Text>
          <Button type="button" variant="secondary" onClick={() => { setElegida(null); setPaso(0); }}>
            Elegir otra necesidad
          </Button>
        </Card>
      )}

      {paso > 0 && necesidad && abierta && (
        <div className="detail-layout">
          <Card as="section" className="form-card">
            <div className="form-card__form">
              {paso === 1 ? (
                <>
                  <div>
                    <button type="button" className="link-btn" onClick={() => { setPaso(0); }}>
                      ← Cambiar necesidad
                    </button>
                  </div>
                  <div className="field">
                    <Text variant="label" as="p">Artículos que donás</Text>
                    <LineaArticuloEditor
                      lineas={lineas}
                      onChange={setLineas}
                      articulosPermitidosIds={articulosPermitidosIds}
                    />
                  </div>
                  <div className="form-card__actions">
                    <Button type="button" variant="primary" disabled={!lineasValidas} onClick={() => { setPaso(2); }}>
                      Continuar
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="nota-comedor">
                      <Text variant="label" as="span">Nota para el comedor (opcional)</Text>
                    </label>
                    <textarea
                      id="nota-comedor"
                      className="field__control field__control--area"
                      rows={4}
                      placeholder="Contale algo al comedor sobre tu donación…"
                      value={observaciones}
                      onChange={(e) => { setObservaciones(e.target.value); }}
                    />
                  </div>

                  {crear.isError && emailNoVerificado && (
                    <Text variant="body-sm" color="urgent">
                      Todavía no validaste tu cuenta.{' '}
                      <Link to="/verify-email">Verificá tu email</Link> para poder ofrecer donaciones.
                    </Text>
                  )}
                  {crear.isError && !emailNoVerificado && (
                    <Text variant="body-sm" color="urgent">{mapDonacionError(crear.error)}</Text>
                  )}

                  <div className="form-card__actions">
                    <Button type="button" variant="ghost" onClick={() => { setPaso(1); }}>
                      ← Volver
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      disabled={!lineasValidas || crear.isPending}
                      loading={crear.isPending}
                      onClick={confirmar}
                    >
                      Confirmar donación
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>
          <ResumenDonacion necesidad={necesidad} lineas={lineas} diasParaAceptar={DIAS_PARA_ACEPTAR} />
        </div>
      )}
    </div>
  );
}
