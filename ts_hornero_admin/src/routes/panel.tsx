import { useState } from 'react';
import { AsyncSection } from '../components/AsyncSection';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/Badge';
import { Text } from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import { useOrganizacionesPendientes } from '../lib/hooks/useOrganizacionesPendientes';
import { useValidarOrganizacion } from '../lib/hooks/useValidarOrganizacion';
import { useRechazarOrganizacion } from '../lib/hooks/useRechazarOrganizacion';
import { mapOrganizacionError } from '../lib/hooks/mapOrganizacionError';
import { ESTADO_ORGANIZACION, TIPO_ORGANIZACION } from '../lib/domain-ui';

export default function PanelPage() {
  const { data, isLoading, isError } = useOrganizacionesPendientes();
  const validar = useValidarOrganizacion();
  const rechazar = useRechazarOrganizacion();
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  return (
    <AsyncSection
      isLoading={isLoading}
      isError={isError}
      isEmpty={data?.length === 0}
      emptyLabel="No hay organizaciones pendientes"
    >
      {data?.map((org) => {
        const isPendiente = org.estado === 'PENDIENTE';
        const isValidarError = validar.isError && validar.variables === org.id;
        const isRechazarError = rechazar.isError && rechazar.variables === org.id;

        return (
          <Card key={org.id}>
            <div>
              <h2>{org.nombre}</h2>
              <Badge {...(TIPO_ORGANIZACION[org.tipo] ?? { tone: 'neutral', label: org.tipo })} />
              <Badge {...(ESTADO_ORGANIZACION[org.estado] ?? { tone: 'neutral', label: org.estado })} />
            </div>

            <div>
              <p>{org.referenteNombre} — {org.referenteEmail}</p>
              <p>{org.descripcion}</p>
              <p>{org.direccion}</p>
            </div>

            {isPendiente && (
              <div>
                <Button
                  variant="ok"
                  loading={validar.isPending && validar.variables === org.id}
                  onClick={() => { validar.mutate(org.id); }}
                >
                  Validar
                </Button>

                {confirmingId === org.id ? (
                  <div>
                    <Text color="urgent">Esta acción no se puede deshacer.</Text>
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
              <Text color="urgent">{mapOrganizacionError(validar.error)}</Text>
            )}
            {isRechazarError && (
              <Text color="urgent">{mapOrganizacionError(rechazar.error)}</Text>
            )}
          </Card>
        );
      })}
    </AsyncSection>
  );
}
