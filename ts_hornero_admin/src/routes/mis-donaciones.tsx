import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMisDonaciones } from '../lib/hooks/useMisDonaciones';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { useCancelarDonacion } from '../lib/hooks/useCancelarDonacion';
import { ESTADO_DONACION, FALLBACK_BADGE, MODALIDAD_DONACION } from '../lib/domain-ui';
import { formatFecha, formatLineas } from '../lib/format';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Pager } from '../components/ui/Pager';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import type { Donacion } from '../types/domain';

const PAGE_SIZE = 20;

// OFRECIDA -> CANCELADA (donante); ACEPTADA, EN_CAMINO -> CANCELADA (either party).
const CANCELABLE_ESTADOS = new Set(['OFRECIDA', 'ACEPTADA', 'EN_CAMINO']);
// A donante may generate/verify delivery codes while ACEPTADA, EN_CAMINO or
// PENDIENTE_CONFIRMACION, as long as they haven't already confirmed on the confirmation screen
// (spec `donacion-entrega-codigo`).
const CONFIRMABLE_ESTADOS = new Set(['ACEPTADA', 'EN_CAMINO', 'PENDIENTE_CONFIRMACION']);

interface DonacionRowProps {
  donacion: Donacion;
}

function DonacionRow({ donacion: d }: DonacionRowProps) {
  const estadoCfg = ESTADO_DONACION[d.estado] ?? FALLBACK_BADGE;
  const modalidadCfg = d.modalidad ? (MODALIDAD_DONACION[d.modalidad] ?? FALLBACK_BADGE) : undefined;
  const cancelar = useCancelarDonacion();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const canCancel = CANCELABLE_ESTADOS.has(d.estado);
  const canConfirm = CONFIRMABLE_ESTADOS.has(d.estado) && !d.confirmadaDonanteEn;
  const isCancelingThis = cancelar.isPending && cancelar.variables === d.id;

  return (
    <Card as="article" style={{ padding: '20px 24px' }}>
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Badge tone={estadoCfg.tone} label={estadoCfg.label} />
        {modalidadCfg && <Badge tone={modalidadCfg.tone} label={modalidadCfg.label} />}
        {d.confirmadaDonanteEn && (
          <Text variant="caption" color="ink-3">Ya confirmaste la entrega</Text>
        )}
      </div>

      {/* FONDO_COMUN starts with `organizacionId: null` until a ronda assigns it — rendered
          gracefully as a plain link to the detail screen, never assumed to be set. */}
      <Link to={`/mis-donaciones/${d.id}`} style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>
        <Text variant="label" color="horn" as="span">Ver detalle →</Text>
      </Link>

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
      {d.lineas && d.lineas.length > 0 && (
        <Text variant="body-sm" color="ink-2" style={{ marginBottom: 2, display: 'block' }}>
          {formatLineas(d.lineas)}
        </Text>
      )}
      {d.observaciones && (
        <Text variant="caption" color="ink-3" style={{ display: 'block', marginTop: 6 }}>
          {d.observaciones}
        </Text>
      )}

      {(canCancel || canConfirm) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {canConfirm && (
            <Link to={`/donaciones/${d.id}/entrega`} style={{ textDecoration: 'none' }}>
              <Button type="button" variant="ok" size="sm">
                Confirmar entrega
              </Button>
            </Link>
          )}
          {canCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={cancelar.isPending}
              onClick={() => setConfirmingCancel(true)}
            >
              Cancelar donación
            </Button>
          )}
        </div>
      )}

      {cancelar.isError && cancelar.variables === d.id && (
        <Text variant="micro" color="urgent" style={{ marginTop: 6, display: 'block' }}>
          No se pudo cancelar la donación. Intentá de nuevo.
        </Text>
      )}

      <ConfirmDialog
        open={confirmingCancel}
        title="¿Cancelar esta donación?"
        description="La donación deja de ofrecerse y de asignarse a una necesidad. No se puede deshacer."
        confirmLabel="Sí, cancelar"
        cancelLabel="Volver"
        loading={isCancelingThis}
        onConfirm={() => cancelar.mutate(d.id, { onSettled: () => setConfirmingCancel(false) })}
        onCancel={() => setConfirmingCancel(false)}
      />
    </Card>
  );
}

export default function MisDonacionesPage() {
  const [page, setPage] = useState(0);
  const { data, isLoading, isError, isFetching } = useMisDonaciones({ page, size: PAGE_SIZE });
  usePageClamp(page, setPage, data?.totalPages);
  const donaciones = data?.content ?? [];

  return (
    <div>
      <PageHeader
        title="Mis donaciones"
        description="Revisá el estado y el historial de las donaciones que realizaste."
      />

      <AsyncSection
        isLoading={isLoading}
        isError={isError}
        isEmpty={!isLoading && !isError && donaciones.length === 0}
        emptyLabel="Aún no realizaste donaciones."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {donaciones.map((d) => (
            <DonacionRow key={d.id} donacion={d} />
          ))}
        </div>

        {data && <Pager page={data} onPageChange={setPage} disabled={isFetching} />}
      </AsyncSection>
    </div>
  );
}
