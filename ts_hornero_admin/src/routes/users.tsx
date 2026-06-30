import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
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
    <AsyncSection
      isLoading={isLoading}
      isError={isError}
      isEmpty={data?.length === 0}
      emptyLabel="No hay usuarios"
    >
      {data?.map((u) => {
        const isSelf = u.id === myId;
        const isMutatingThis =
          toggleActivo.isPending && toggleActivo.variables?.id === u.id;

        return (
          <div key={u.id}>
            <span>{u.nombre}</span>
            <span>{u.email}</span>
            <Badge tone="neutral" label={ROLE_LABEL[u.tipo] ?? u.tipo} />
            <Badge {...(ACTIVO[String(u.activo)] ?? { tone: 'neutral', label: String(u.activo) })} />
            <Button
              variant={u.activo ? 'danger' : 'ok'}
              size="sm"
              disabled={isSelf || isMutatingThis}
              title={isSelf ? 'No podés desactivar tu propia cuenta' : undefined}
              onClick={() => { toggleActivo.mutate({ id: u.id, activo: !u.activo }); }}
            >
              {u.activo ? 'Desactivar' : 'Activar'}
            </Button>
            {toggleActivo.isError && toggleActivo.variables?.id === u.id && (
              <Text color="urgent">{mapUsuarioError(toggleActivo.error)}</Text>
            )}
          </div>
        );
      })}
    </AsyncSection>
  );
}
