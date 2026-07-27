import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import { useUsuarios } from '../lib/hooks/useUsuarios';
import { useToggleActivo } from '../lib/hooks/useToggleActivo';
import { mapUsuarioError } from '../lib/hooks/mapUsuarioError';
import { ACTIVO } from '../lib/domain-ui';
import { useAuthStore } from '../store/auth.store';

const ROLE_LABEL: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  REFERENTE:     'Referente',
  DONANTE:       'Donante',
};

export default function UsersPage() {
  const { data, isLoading, isError } = useUsuarios();
  const toggleActivo = useToggleActivo();
  const myId = useAuthStore((s) => s.user?.userId);

  return (
    <div>
      <Text variant="h1">Usuarios</Text>

      <AsyncSection
        isLoading={isLoading}
        isError={isError}
        isEmpty={data?.length === 0}
        emptyLabel="No hay usuarios"
      >
        <Card style={{ padding: 0, marginTop: 20, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th style={{ textAlign: 'left', padding: '12px 20px' }}>
                  <Text variant="caption">Nombre</Text>
                </th>
                <th style={{ textAlign: 'left', padding: '12px 20px' }}>
                  <Text variant="caption">Email</Text>
                </th>
                <th style={{ textAlign: 'left', padding: '12px 20px' }}>
                  <Text variant="caption">Rol</Text>
                </th>
                <th style={{ textAlign: 'left', padding: '12px 20px' }}>
                  <Text variant="caption">Estado</Text>
                </th>
                <th style={{ textAlign: 'right', padding: '12px 20px' }}>
                  <Text variant="caption">Acción</Text>
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.map((u) => {
                const isSelf = u.id === myId;
                const isMutatingThis =
                  toggleActivo.isPending && toggleActivo.variables?.id === u.id;
                const isErrorForThis =
                  toggleActivo.isError && toggleActivo.variables?.id === u.id;

                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <Text variant="body">{u.nombre}</Text>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <Text variant="body-sm" color="ink-3">{u.email}</Text>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <Badge tone="neutral" label={ROLE_LABEL[u.tipo] ?? u.tipo} />
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <Badge {...(ACTIVO[String(u.activo)] ?? { tone: 'neutral', label: String(u.activo) })} />
                      {isErrorForThis && (
                        <Text color="urgent" variant="micro" style={{ display: 'block', marginTop: 4 }}>
                          {mapUsuarioError(toggleActivo.error)}
                        </Text>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <Button
                        variant={u.activo ? 'danger' : 'ok'}
                        size="sm"
                        disabled={isSelf || isMutatingThis}
                        title={isSelf ? 'No podés desactivar tu propia cuenta' : undefined}
                        onClick={() => { toggleActivo.mutate({ id: u.id, activo: !u.activo }); }}
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </AsyncSection>
    </div>
  );
}
