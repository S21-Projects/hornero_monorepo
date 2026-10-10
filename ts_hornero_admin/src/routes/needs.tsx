import { useState } from 'react';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Button } from '../components/ui/Button';
import { Pager } from '../components/ui/Pager';
import { Text } from '../components/ui/Typography';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useNecesidadesDeOrg } from '../lib/hooks/useNecesidadesDeOrg';
import { useCrearNecesidad } from '../lib/hooks/useCrearNecesidad';
import { useActualizarNecesidad } from '../lib/hooks/useActualizarNecesidad';
import { useEliminarNecesidad } from '../lib/hooks/useEliminarNecesidad';
import { useRelanzarNecesidad } from '../lib/hooks/useRelanzarNecesidad';
import { mapNecesidadError } from '../lib/hooks/mapNecesidadError';
import { ArticuloPicker } from '../components/necesidad/ArticuloPicker';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { PRIORIDAD, ESTADO_NECESIDAD, FALLBACK_BADGE } from '../lib/domain-ui';
import { formatFecha } from '../lib/format';
import type { Necesidad, PrioridadNecesidad, EstadoNecesidad } from '../types/domain';
import { useNeedsViewState } from './needs-view-state';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Create form
// ---------------------------------------------------------------------------
interface CreateFormProps {
  orgId: number;
  onSuccess(): void;
  onCancel(): void;
}

function CreateForm({ orgId, onSuccess, onCancel }: CreateFormProps) {
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<PrioridadNecesidad | ''>('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [articuloIds, setArticuloIds] = useState<number[]>([]);
  const [fieldError, setFieldError] = useState('');

  const crearMutation = useCrearNecesidad(orgId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descripcion.trim()) {
      setFieldError('La descripción es obligatoria.');
      return;
    }
    if (!prioridad) {
      setFieldError('La prioridad es obligatoria.');
      return;
    }
    if (articuloIds.length === 0) {
      setFieldError('Elegí al menos un artículo.');
      return;
    }
    setFieldError('');
    try {
      await crearMutation.mutateAsync({
        descripcion: descripcion.trim(),
        prioridad,
        fechaVencimiento: fechaVencimiento || undefined,
        articuloIds,
      });
      onSuccess();
    } catch (err) {
      // error handled below via crearMutation.error
      void err;
    }
  }

  const mutationError =
    crearMutation.isError ? mapNecesidadError(crearMutation.error) : null;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Text variant="h3">Nueva necesidad</Text>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Text variant="label">Descripción *</Text>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          style={{ resize: 'vertical', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 'var(--fs-body)' }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Text variant="label">Prioridad *</Text>
        <select
          value={prioridad}
          onChange={(e) => setPrioridad(e.target.value as PrioridadNecesidad)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 'var(--fs-body)' }}
        >
          <option value="">Seleccioná una prioridad</option>
          <option value="URGENTE">Urgente</option>
          <option value="MEDIA">Media</option>
          <option value="NORMAL">Normal</option>
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Text variant="label">Fecha de vencimiento (opcional)</Text>
        <input
          type="date"
          value={fechaVencimiento}
          onChange={(e) => setFechaVencimiento(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 'var(--fs-body)' }}
        />
      </label>

      <div>
        <Text variant="label" style={{ display: 'block', marginBottom: 4 }}>Artículos solicitados *</Text>
        <ArticuloPicker selectedIds={articuloIds} onChange={setArticuloIds} />
      </div>

      {fieldError && (
        <Text variant="body" color="urgent">{fieldError}</Text>
      )}
      {mutationError && (
        <Text variant="body" color="urgent">{mutationError}</Text>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="submit" variant="primary" disabled={crearMutation.isPending}>
          {crearMutation.isPending ? 'Guardando…' : 'Crear necesidad'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Edit form
// ---------------------------------------------------------------------------
interface EditFormProps {
  need: Necesidad;
  orgId: number;
  onSuccess(): void;
  onCancel(): void;
}

function EditForm({ need, orgId, onSuccess, onCancel }: EditFormProps) {
  const [descripcion, setDescripcion] = useState(need.descripcion);
  const [prioridad, setPrioridad] = useState<PrioridadNecesidad>(need.prioridad);
  const [estado, setEstado] = useState<EstadoNecesidad>(need.estado);
  const [fechaVencimiento, setFechaVencimiento] = useState(need.fechaVencimiento ?? '');
  const [articuloIds, setArticuloIds] = useState<number[]>(
    need.articulos?.map((a) => a.id) ?? [],
  );
  const [fieldError, setFieldError] = useState('');

  const actualizarMutation = useActualizarNecesidad(orgId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (articuloIds.length === 0) {
      setFieldError('Elegí al menos un artículo.');
      return;
    }
    setFieldError('');
    try {
      await actualizarMutation.mutateAsync({
        id: need.id,
        descripcion: descripcion.trim(),
        prioridad,
        // A VENCIDA necesidad keeps its estado here; reopening goes through "Relanzar".
        estado: need.estado === 'VENCIDA' ? undefined : estado,
        fechaVencimiento: fechaVencimiento || undefined,
        articuloIds,
      });
      onSuccess();
    } catch (err) {
      void err;
    }
  }

  const mutationError =
    actualizarMutation.isError ? mapNecesidadError(actualizarMutation.error) : null;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Text variant="h3">Editar necesidad</Text>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Text variant="label">Descripción</Text>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          style={{ resize: 'vertical', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 'var(--fs-body)' }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Text variant="label">Prioridad</Text>
        <select
          value={prioridad}
          onChange={(e) => setPrioridad(e.target.value as PrioridadNecesidad)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 'var(--fs-body)' }}
        >
          <option value="URGENTE">Urgente</option>
          <option value="MEDIA">Media</option>
          <option value="NORMAL">Normal</option>
        </select>
      </label>

      {need.estado === 'VENCIDA' ? (
        <Text variant="caption" color="ink-3">
          Esta necesidad está vencida. Para reabrirla usá «Relanzar» desde la lista.
        </Text>
      ) : (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Text variant="label">Estado</Text>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoNecesidad)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 'var(--fs-body)' }}
          >
            <option value="ABIERTA">Abierta</option>
            <option value="EN_PROGRESO">En progreso</option>
            <option value="CUMPLIDA">Cumplida</option>
            <option value="VENCIDA">Vencida</option>
          </select>
        </label>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Text variant="label">Fecha de vencimiento (opcional)</Text>
        <input
          type="date"
          value={fechaVencimiento}
          onChange={(e) => setFechaVencimiento(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 'var(--fs-body)' }}
        />
      </label>

      <div>
        <Text variant="label" style={{ display: 'block', marginBottom: 4 }}>Artículos solicitados *</Text>
        <ArticuloPicker selectedIds={articuloIds} onChange={setArticuloIds} />
      </div>

      {fieldError && (
        <Text variant="body" color="urgent">{fieldError}</Text>
      )}
      {mutationError && (
        <Text variant="body" color="urgent">{mutationError}</Text>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="submit" variant="primary" disabled={actualizarMutation.isPending}>
          {actualizarMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Relaunch form (inline, VENCIDA necesidades only)
// ---------------------------------------------------------------------------
interface RelaunchFormProps {
  needId: number;
  orgId: number;
  onDone(): void;
}

function RelaunchForm({ needId, orgId, onDone }: RelaunchFormProps) {
  const [fecha, setFecha] = useState('');
  const [fieldError, setFieldError] = useState('');
  const relanzarMutation = useRelanzarNecesidad(orgId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fecha) {
      setFieldError('Elegí una fecha de vencimiento.');
      return;
    }
    setFieldError('');
    try {
      await relanzarMutation.mutateAsync({ id: needId, fechaVencimiento: fecha });
      onDone();
    } catch (err) {
      void err;
    }
  }

  const mutationError = relanzarMutation.isError ? mapNecesidadError(relanzarMutation.error) : null;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Text variant="label">Nueva fecha de vencimiento *</Text>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 'var(--fs-body)', maxWidth: 220 }}
        />
      </label>
      {fieldError && <Text variant="caption" color="urgent">{fieldError}</Text>}
      {mutationError && <Text variant="caption" color="urgent">{mutationError}</Text>}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="submit" variant="primary" disabled={relanzarMutation.isPending}>
          {relanzarMutation.isPending ? 'Relanzando…' : 'Confirmar relanzamiento'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// NeedsPage (list view + in-page create/edit routing)
// ---------------------------------------------------------------------------
export default function NeedsPage() {
  const { view, pendingDeleteId, goToList, goToCreate, goToEdit, armDelete, clearDelete } =
    useNeedsViewState();

  const orgsQuery = useMisOrganizaciones();
  const orgs = orgsQuery.data ?? [];

  // Referentes owning >1 organización pick which one they're managing needs
  // for; single-org referentes never see the selector. Derived (not effect-set)
  // so it also self-heals if the selected org disappears from the list (e.g.
  // reassigned away by an admin mid-session) — falls back to the first org.
  const [explicitOrgId, setExplicitOrgId] = useState<number | null>(null);
  const orgId =
    explicitOrgId != null && orgs.some((o) => o.id === explicitOrgId)
      ? explicitOrgId
      : (orgs[0]?.id ?? null);

  const [page, setPage] = useState(0);
  const needsQuery = useNecesidadesDeOrg(orgId, { page, size: PAGE_SIZE });
  usePageClamp(page, setPage, needsQuery.data?.totalPages);
  const needsContent = needsQuery.data?.content ?? [];
  const eliminarMutation = useEliminarNecesidad(orgId ?? 0);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [relanzandoId, setRelanzandoId] = useState<number | null>(null);

  // Resolve which need is being edited (if view is an object)
  const editingNeed: Necesidad | undefined =
    typeof view === 'object'
      ? needsContent.find((n) => n.id === view.id)
      : undefined;

  async function handleConfirmDelete(id: number) {
    setDeleteError(null);
    try {
      await eliminarMutation.mutateAsync(id);
      clearDelete();
    } catch (err) {
      setDeleteError(mapNecesidadError(err));
      clearDelete();
    }
  }

  // Loading orgs query first
  if (orgsQuery.isLoading) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <Text variant="body" color="ink-3">Cargando…</Text>
      </div>
    );
  }

  if (orgsQuery.isError || !orgId) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <Text variant="body" color="urgent">
          No se pudo cargar tu organización. Intentá de nuevo más tarde.
        </Text>
      </div>
    );
  }

  const orgSelector = orgs.length > 1 && (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
      <Text variant="label">Organización</Text>
      <select
        value={orgId}
        onChange={(e) => setExplicitOrgId(Number(e.target.value))}
        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 'var(--fs-body)', maxWidth: 320 }}
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>{o.nombre}</option>
        ))}
      </select>
    </label>
  );

  if (view === 'create') {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
        <CreateForm orgId={orgId} onSuccess={goToList} onCancel={goToList} />
      </div>
    );
  }

  if (typeof view === 'object') {
    if (!editingNeed) {
      return (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <Text variant="body" color="ink-3">Cargando necesidad…</Text>
        </div>
      );
    }
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
        <EditForm need={editingNeed} orgId={orgId} onSuccess={goToList} onCancel={goToList} />
      </div>
    );
  }

  // List view
  const needs = needsContent;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Text variant="h2">Mis necesidades</Text>
        <Button variant="primary" onClick={goToCreate}>
          + Nueva necesidad
        </Button>
      </div>

      {orgSelector}

      {deleteError && (
        <div style={{ marginBottom: 16 }}>
          <Text variant="body" color="urgent">{deleteError}</Text>
        </div>
      )}

      <AsyncSection
        isLoading={needsQuery.isLoading}
        isError={needsQuery.isError}
        isEmpty={needs.length === 0}
        emptyLabel="Todavía no publicaste ninguna necesidad."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {needs.map((need) => {
            const prioConfig = PRIORIDAD[need.prioridad] ?? FALLBACK_BADGE;
            const estadoConfig = ESTADO_NECESIDAD[need.estado] ?? FALLBACK_BADGE;
            const isPendingDelete = pendingDeleteId === need.id;

            return (
              <div
                key={need.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '16px',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Text variant="body">{need.descripcion}</Text>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Badge tone={prioConfig.tone} label={prioConfig.label} />
                    <Badge tone={estadoConfig.tone} label={estadoConfig.label} />
                    {need.fechaVencimiento && (
                      <Text variant="caption" color="ink-3">
                        Vence: {formatFecha(need.fechaVencimiento)}
                      </Text>
                    )}
                  </div>
                  {need.articulos && need.articulos.length > 0 && (
                    <Text variant="caption" color="ink-3">
                      Artículos: {need.articulos.map((a) => a.nombre).join(', ')}
                    </Text>
                  )}
                  {relanzandoId === need.id && (
                    <RelaunchForm needId={need.id} orgId={orgId} onDone={() => setRelanzandoId(null)} />
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {!isPendingDelete ? (
                    <>
                      {need.estado === 'VENCIDA' && relanzandoId !== need.id && (
                        <Button variant="primary" onClick={() => { clearDelete(); setRelanzandoId(need.id); }}>
                          Relanzar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        onClick={() => { clearDelete(); goToEdit(need.id); }}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => armDelete(need.id)}
                      >
                        Eliminar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Text variant="caption" color="urgent" style={{ alignSelf: 'center' }}>
                        ¿Confirmar eliminación?
                      </Text>
                      <Button
                        variant="primary"
                        onClick={() => handleConfirmDelete(need.id)}
                        disabled={eliminarMutation.isPending}
                      >
                        Sí, eliminar
                      </Button>
                      <Button variant="ghost" onClick={clearDelete}>
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {needsQuery.data && (
          <Pager page={needsQuery.data} onPageChange={setPage} disabled={needsQuery.isFetching} />
        )}
      </AsyncSection>
    </div>
  );
}
