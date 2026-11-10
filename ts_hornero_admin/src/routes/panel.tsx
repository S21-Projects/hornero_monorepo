import { useState } from 'react';
import { Badge } from '../components/Badge';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { PaginatedTable } from '../components/ui/PaginatedTable';
import type { Column } from '../components/ui/PaginatedTable';
import { useOrganizacionesPendientes } from '../lib/hooks/useOrganizacionesPendientes';
import { useValidarOrganizacion } from '../lib/hooks/useValidarOrganizacion';
import { useRechazarOrganizacion } from '../lib/hooks/useRechazarOrganizacion';
import { mapOrganizacionError } from '../lib/hooks/mapOrganizacionError';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { ESTADO_ORGANIZACION, TIPO_ORGANIZACION } from '../lib/domain-ui';

const PAGE_SIZE = 10;

type OrgPendiente = NonNullable<ReturnType<typeof useOrganizacionesPendientes>['data']>['content'][number];

export default function PanelPage() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const { data, isLoading, isError, isFetching, refetch } = useOrganizacionesPendientes({ page, size: pageSize });
  usePageClamp(page, setPage, data?.totalPages);
  const validar = useValidarOrganizacion();
  const rechazar = useRechazarOrganizacion();
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const columns: Column<OrgPendiente>[] = [
    {
      key: 'organizacion',
      header: 'Organización',
      render: (org) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Text variant="body" style={{ fontWeight: 700 }}>{org.nombre}</Text>
          {org.descripcion && <Text variant="body-sm" color="ink-3">{org.descripcion}</Text>}
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (org) => <Badge {...(TIPO_ORGANIZACION[org.tipo] ?? { tone: 'neutral', label: org.tipo })} />,
    },
    {
      key: 'referente',
      header: 'Referente',
      render: (org) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Text variant="body-sm">{org.referenteNombre}</Text>
          <Text variant="body-sm" color="ink-3">{org.referenteEmail}</Text>
        </div>
      ),
    },
    {
      key: 'direccion',
      header: 'Dirección',
      render: (org) => <Text variant="body-sm" color="ink-2">{org.direccion}</Text>,
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (org) => <Badge {...(ESTADO_ORGANIZACION[org.estado] ?? { tone: 'neutral', label: org.estado })} />,
    },
  ];

  function acciones(org: OrgPendiente) {
    if (org.estado !== 'PENDIENTE') return null;
    const isValidarError = validar.isError && validar.variables === org.id;
    const isRechazarError = rechazar.isError && rechazar.variables === org.id;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        {confirmingId === org.id ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Text color="urgent" variant="body-sm">Esta acción no se puede deshacer.</Text>
            <Button
              variant="danger"
              size="sm"
              loading={rechazar.isPending && rechazar.variables === org.id}
              onClick={() => {
                // Close the confirmation only after the rejection succeeds, so the
                // pending state is visible and a 409 keeps it open with the error.
                rechazar.mutate(org.id, {
                  onSuccess: () => { setConfirmingId(null); },
                });
              }}
            >
              Confirmar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setConfirmingId(null); }}>
              Cancelar
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="ok"
              size="sm"
              loading={validar.isPending && validar.variables === org.id}
              onClick={() => { validar.mutate(org.id); }}
            >
              Validar
            </Button>
            <Button variant="danger" size="sm" onClick={() => { setConfirmingId(org.id); }}>
              Rechazar
            </Button>
          </div>
        )}
        {isValidarError && (
          <Text color="urgent" variant="micro">{mapOrganizacionError(validar.error)}</Text>
        )}
        {isRechazarError && (
          <Text color="urgent" variant="micro">{mapOrganizacionError(rechazar.error)}</Text>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Organizaciones pendientes"
        description="Validá las organizaciones que solicitaron acceso a la plataforma."
      />

      <PaginatedTable
        columns={columns}
        rows={data?.content ?? []}
        rowKey={(org) => org.id}
        rowActions={acciones}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => { void refetch(); }}
        isFetching={isFetching}
        emptyLabel="No hay organizaciones pendientes"
        page={data ?? { number: 0, size: pageSize, totalElements: 0, totalPages: 0 }}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(0); }}
      />
    </div>
  );
}
