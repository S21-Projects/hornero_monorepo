import { useState } from 'react';
import { AsyncSection } from '../components/AsyncSection';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/Badge';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Pager } from '../components/ui/Pager';
import { useOrganizacionesPendientes } from '../lib/hooks/useOrganizacionesPendientes';
import { useValidarOrganizacion } from '../lib/hooks/useValidarOrganizacion';
import { useRechazarOrganizacion } from '../lib/hooks/useRechazarOrganizacion';
import { mapOrganizacionError } from '../lib/hooks/mapOrganizacionError';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { ESTADO_ORGANIZACION, TIPO_ORGANIZACION } from '../lib/domain-ui';

const PAGE_SIZE = 20;

export default function PanelPage() {
  const [page, setPage] = useState(0);
  const { data, isLoading, isError, isFetching } = useOrganizacionesPendientes({ page, size: PAGE_SIZE });
  usePageClamp(page, setPage, data?.totalPages);
  const pendientes = data?.content ?? [];
  const validar = useValidarOrganizacion();
  const rechazar = useRechazarOrganizacion();
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  return (
    <div>
      <PageHeader
        title="Organizaciones pendientes"
        description="Validá las organizaciones que solicitaron acceso a la plataforma."
      />

      <AsyncSection
        isLoading={isLoading}
        isError={isError}
        isEmpty={pendientes.length === 0}
        emptyLabel="No hay organizaciones pendientes"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
            marginTop: 20,
          }}
        >
          {pendientes.map((org) => {
            const isPendiente = org.estado === 'PENDIENTE';
            const isValidarError = validar.isError && validar.variables === org.id;
            const isRechazarError = rechazar.isError && rechazar.variables === org.id;

            return (
              <Card key={org.id} style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text variant="title" as="h2">{org.nombre}</Text>
                  <Badge {...(TIPO_ORGANIZACION[org.tipo] ?? { tone: 'neutral', label: org.tipo })} />
                  <Badge {...(ESTADO_ORGANIZACION[org.estado] ?? { tone: 'neutral', label: org.estado })} />
                </div>

                <div style={{ marginTop: 12 }}>
                  <Text variant="body-sm" color="ink-3">{org.referenteNombre} — {org.referenteEmail}</Text>
                  <Text variant="body-sm" style={{ marginTop: 4 }}>{org.descripcion}</Text>
                  <Text variant="body-sm" color="ink-3" style={{ marginTop: 4 }}>{org.direccion}</Text>
                </div>

                {isPendiente && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                    <Button
                      variant="ok"
                      loading={validar.isPending && validar.variables === org.id}
                      onClick={() => { validar.mutate(org.id); }}
                    >
                      Validar
                    </Button>

                    {confirmingId === org.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text color="urgent" variant="body-sm">Esta acción no se puede deshacer.</Text>
                        <Button
                          variant="danger"
                          loading={rechazar.isPending && rechazar.variables === org.id}
                          onClick={() => {
                            // Close the dialog only after the rejection succeeds, so the
                            // pending state is visible and a 409 keeps the dialog + error.
                            rechazar.mutate(org.id, {
                              onSuccess: () => { setConfirmingId(null); },
                            });
                          }}
                        >
                          Confirmar
                        </Button>
                        <Button variant="ghost" onClick={() => { setConfirmingId(null); }}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button variant="danger" onClick={() => { setConfirmingId(org.id); }}>
                        Rechazar
                      </Button>
                    )}
                  </div>
                )}

                {isValidarError && (
                  <Text color="urgent" variant="micro" style={{ display: 'block', marginTop: 8 }}>
                    {mapOrganizacionError(validar.error)}
                  </Text>
                )}
                {isRechazarError && (
                  <Text color="urgent" variant="micro" style={{ display: 'block', marginTop: 8 }}>
                    {mapOrganizacionError(rechazar.error)}
                  </Text>
                )}
              </Card>
            );
          })}
        </div>

        {data && <Pager page={data} onPageChange={setPage} disabled={isFetching} />}
      </AsyncSection>
    </div>
  );
}
