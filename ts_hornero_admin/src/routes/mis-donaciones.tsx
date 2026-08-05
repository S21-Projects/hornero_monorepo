import { useState } from 'react';
import { useMisDonaciones } from '../lib/hooks/useMisDonaciones';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { useCancelarDonacion } from '../lib/hooks/useCancelarDonacion';
import { useConfirmarEntrega } from '../lib/hooks/useConfirmarEntrega';
import { ESTADO_DONACION, FALLBACK_BADGE } from '../lib/domain-ui';
import { formatFecha } from '../lib/format';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Pager } from '../components/ui/Pager';
import { Text } from '../components/ui/Typography';
import type { Donacion } from '../types/domain';

const PAGE_SIZE = 20;

// OFRECIDA -> CANCELADA (donante); ACEPTADA, EN_CAMINO -> CANCELADA (either party).
const CANCELABLE_ESTADOS = new Set(['OFRECIDA', 'ACEPTADA', 'EN_CAMINO']);
// A donante may confirm delivery while ACEPTADA, EN_CAMINO or PENDIENTE_CONFIRMACION,
// as long as they haven't already confirmed (idempotent no-op on the MS otherwise).
const CONFIRMABLE_ESTADOS = new Set(['ACEPTADA', 'EN_CAMINO', 'PENDIENTE_CONFIRMACION']);

interface DonacionRowProps {
  donacion: Donacion;
}

function DonacionRow({ donacion: d }: DonacionRowProps) {
  const estadoCfg = ESTADO_DONACION[d.estado] ?? FALLBACK_BADGE;
  const cancelar = useCancelarDonacion();
  const confirmar = useConfirmarEntrega();

  const canCancel = CANCELABLE_ESTADOS.has(d.estado);
  const canConfirm = CONFIRMABLE_ESTADOS.has(d.estado) && !d.confirmadaDonanteEn;
  const isCancelingThis = cancelar.isPending && cancelar.variables === d.id;
  const isConfirmingThis = confirmar.isPending && confirmar.variables === d.id;

  return (
    <Card as="article" style={{ padding: '20px 24px' }}>
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Badge tone={estadoCfg.tone} label={estadoCfg.label} />
        {d.confirmadaDonanteEn && (
          <Text variant="caption" color="ink-3">Ya confirmaste la entrega</Text>
        )}
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

      {(canCancel || canConfirm) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {canConfirm && (
            <Button
              type="button"
              variant="ok"
              size="sm"
              loading={isConfirmingThis}
              disabled={confirmar.isPending}
              onClick={() => confirmar.mutate(d.id)}
            >
              Confirmar entrega
            </Button>
          )}
          {canCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={isCancelingThis}
              disabled={cancelar.isPending}
              onClick={() => cancelar.mutate(d.id)}
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
      {confirmar.isError && confirmar.variables === d.id && (
        <Text variant="micro" color="urgent" style={{ marginTop: 6, display: 'block' }}>
          No se pudo confirmar la entrega. Intentá de nuevo.
        </Text>
      )}
    </Card>
  );
}

export default function MisDonacionesPage() {
  const [page, setPage] = useState(0);
  const { data, isLoading, isError, isFetching } = useMisDonaciones({ page, size: PAGE_SIZE });
  usePageClamp(page, setPage, data?.totalPages);
  const donaciones = data?.content ?? [];

  return (
    <div style={{ maxWidth: 720 }}>
      <Text variant="h2" style={{ marginBottom: 24 }}>Mis donaciones</Text>

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
