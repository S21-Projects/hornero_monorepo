import { useState } from 'react';
import { Trash } from 'iconsax-reactjs';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { PendingValidationCard } from '../components/PendingValidationCard';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Pager } from '../components/ui/Pager';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
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
import { useAuthStore } from '../store/auth.store';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Form page shell: back link, heading and the form body inside a Card
// ---------------------------------------------------------------------------
function FormPage({ title, onBack, children }: { title: string; onBack(): void; children: React.ReactNode }) {
  return (
    <div className="form-page">
      <button type="button" className="form-page__back" onClick={onBack}>
        ← Mis necesidades
      </button>
      <Text variant="h3" style={{ display: 'block', marginBottom: 16 }}>{title}</Text>
      <Card className="form-card">{children}</Card>
    </div>
  );
}

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
    <form onSubmit={handleSubmit} className="form-card__form">
      <label className="field">
        <Text variant="label">Descripción *</Text>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          className="field__control field__control--area"
        />
      </label>

      <label className="field">
        <Text variant="label">Prioridad *</Text>
        <select
          value={prioridad}
          onChange={(e) => setPrioridad(e.target.value as PrioridadNecesidad)}
          className="field__control"
        >
          <option value="">Seleccioná una prioridad</option>
          <option value="URGENTE">Urgente</option>
          <option value="MEDIA">Media</option>
          <option value="NORMAL">Normal</option>
        </select>
      </label>

      <label className="field">
        <Text variant="label">Fecha de vencimiento (opcional)</Text>
        <input
          type="date"
          value={fechaVencimiento}
          onChange={(e) => setFechaVencimiento(e.target.value)}
          className="field__control"
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

      <div className="form-card__actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={crearMutation.isPending}>
          {crearMutation.isPending ? 'Guardando…' : 'Crear necesidad'}
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
    <form onSubmit={handleSubmit} className="form-card__form">
      <label className="field">
        <Text variant="label">Descripción</Text>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          className="field__control field__control--area"
        />
      </label>

      <label className="field">
        <Text variant="label">Prioridad</Text>
        <select
          value={prioridad}
          onChange={(e) => setPrioridad(e.target.value as PrioridadNecesidad)}
          className="field__control"
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
        <label className="field">
          <Text variant="label">Estado</Text>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoNecesidad)}
            className="field__control"
          >
            <option value="ABIERTA">Abierta</option>
            <option value="EN_PROGRESO">En progreso</option>
            <option value="CUMPLIDA">Cumplida</option>
            <option value="VENCIDA">Vencida</option>
          </select>
        </label>
      )}

      <label className="field">
        <Text variant="label">Fecha de vencimiento (opcional)</Text>
        <input
          type="date"
          value={fechaVencimiento}
          onChange={(e) => setFechaVencimiento(e.target.value)}
          className="field__control"
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

      <div className="form-card__actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={actualizarMutation.isPending}>
          {actualizarMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
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
    <form onSubmit={handleSubmit} className="form-card__form" style={{ gap: 10, marginTop: 4 }}>
      <label className="field">
        <Text variant="label">Nueva fecha de vencimiento *</Text>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="field__control" style={{ maxWidth: 220 }}
        />
      </label>
      {fieldError && <Text variant="caption" color="urgent">{fieldError}</Text>}
      {mutationError && <Text variant="caption" color="urgent">{mutationError}</Text>}
      <div className="form-card__actions">
        <Button type="button" variant="secondary" size="sm" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={relanzarMutation.isPending}>
          {relanzarMutation.isPending ? 'Relanzando…' : 'Confirmar relanzamiento'}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// NeedsPage (list view + in-page create/edit routing)
// ---------------------------------------------------------------------------
const NEEDS_DESCRIPTION = 'Publicá y gestioná las necesidades de tu organización.';

export default function NeedsPage() {
  const { view, pendingDeleteId, goToList, goToCreate, goToEdit, armDelete, clearDelete } =
    useNeedsViewState();

  const orgsQuery = useMisOrganizaciones();
  const orgs = orgsQuery.data ?? [];
  const tipo = useAuthStore((s) => s.user?.tipo);

  // Referentes owning >1 organización pick which one they're managing needs
  // for; single-org referentes never see the selector. Derived (not effect-set)
  // so it also self-heals if the selected org disappears from the list (e.g.
  // reassigned away by an admin mid-session) — falls back to the first org.
  const [explicitOrgId, setExplicitOrgId] = useState<number | null>(null);
  const orgId =
    explicitOrgId != null && orgs.some((o) => o.id === explicitOrgId)
      ? explicitOrgId
      : (orgs[0]?.id ?? null);

  // The selected org may still be pending (no org validated yet, or another
  // owned org is validated): the page shows the pending state instead of the list.
  const selectedOrg = orgs.find((o) => o.id === orgId);
  const orgPendiente = selectedOrg?.validada === false;

  const [page, setPage] = useState(0);
  const needsQuery = useNecesidadesDeOrg(orgPendiente ? null : orgId, { page, size: PAGE_SIZE });
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

  // The route is not gated on validation, so a REFERENTE without any
  // organización keeps the AppShell and sees the pending state here.
  if (orgsQuery.isSuccess && orgs.length === 0 && tipo === 'REFERENTE') {
    return (
      <div>
        <PageHeader title="Mis necesidades" description={NEEDS_DESCRIPTION} />
        <PendingValidationCard orgNombre={null} />
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
        className="field__control" style={{ maxWidth: 320 }}
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>{o.nombre}</option>
        ))}
      </select>
    </label>
  );

  if (orgPendiente) {
    return (
      <div>
        <PageHeader title="Mis necesidades" description={NEEDS_DESCRIPTION} />
        {orgSelector}
        <PendingValidationCard orgNombre={selectedOrg?.nombre ?? ''} />
      </div>
    );
  }

  if (view === 'create') {
    return (
      <FormPage title="Nueva necesidad" onBack={goToList}>
        <CreateForm orgId={orgId} onSuccess={goToList} onCancel={goToList} />
      </FormPage>
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
      <FormPage title="Editar necesidad" onBack={goToList}>
        <EditForm need={editingNeed} orgId={orgId} onSuccess={goToList} onCancel={goToList} />
      </FormPage>
    );
  }

  // List view
  const needs = needsContent;
  const pendingDelete = needs.find((n) => n.id === pendingDeleteId);

  return (
    <div>
      <PageHeader
        title="Mis necesidades"
        description={NEEDS_DESCRIPTION}
        actions={
          <Button variant="primary" onClick={goToCreate}>
            + Nueva necesidad
          </Button>
        }
      />

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

            return (
              <Card as="article" key={need.id} className="list-card">
                <div className="list-card__body">
                  <Text variant="title" as="h3">{need.descripcion}</Text>
                  <div className="list-card__badges">
                    <Badge tone={prioConfig.tone} label={prioConfig.label} />
                    <Badge tone={estadoConfig.tone} label={estadoConfig.label} />
                  </div>
                  {need.fechaVencimiento && (
                    <Text variant="caption" color="ink-3">
                      Vence: {formatFecha(need.fechaVencimiento)}
                    </Text>
                  )}
                  {need.articulos && need.articulos.length > 0 && (
                    <Text variant="caption" color="ink-3">
                      Artículos: {need.articulos.map((a) => a.nombre).join(', ')}
                    </Text>
                  )}
                  {relanzandoId === need.id && (
                    <RelaunchForm needId={need.id} orgId={orgId} onDone={() => setRelanzandoId(null)} />
                  )}
                </div>

                <div className="list-card__actions">
                  {need.estado === 'VENCIDA' && relanzandoId !== need.id && (
                    <Button variant="primary" size="sm" onClick={() => { clearDelete(); setRelanzandoId(need.id); }}>
                      Relanzar
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { clearDelete(); goToEdit(need.id); }}
                  >
                    Editar
                  </Button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    aria-label="Eliminar necesidad"
                    onClick={() => armDelete(need.id)}
                  >
                    <Trash size={20} aria-hidden="true" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>

        {needsQuery.data && (
          <Pager page={needsQuery.data} onPageChange={setPage} disabled={needsQuery.isFetching} />
        )}
      </AsyncSection>

      <ConfirmDialog
        open={pendingDelete !== undefined}
        title="¿Eliminar esta necesidad?"
        description={
          pendingDelete && (
            <>
              “{pendingDelete.descripcion}” deja de verse en el sitio público y no recibe nuevas
              donaciones. No se puede deshacer.
            </>
          )
        }
        confirmLabel="Sí, eliminar"
        loading={eliminarMutation.isPending}
        onConfirm={() => { if (pendingDelete) void handleConfirmDelete(pendingDelete.id); }}
        onCancel={clearDelete}
      />
    </div>
  );
}
