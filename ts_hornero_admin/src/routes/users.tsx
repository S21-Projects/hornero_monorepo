import { useState } from 'react';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Text } from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import { PaginatedTable } from '../components/ui/PaginatedTable';
import type { Column } from '../components/ui/PaginatedTable';
import { useUsuarios } from '../lib/hooks/useUsuarios';
import { useToggleActivo } from '../lib/hooks/useToggleActivo';
import { mapUsuarioError } from '../lib/hooks/mapUsuarioError';
import { usePageClamp } from '../lib/hooks/usePageClamp';
import { ACTIVO } from '../lib/domain-ui';
import { useAuthStore } from '../store/auth.store';
import type { Usuario } from '../types/domain';

const ROLE_LABEL: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  REFERENTE:     'Referente',
  DONANTE:       'Donante',
};

const PAGE_SIZE = 20;

export default function UsersPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, isFetching } = useUsuarios({ page, size: PAGE_SIZE });
  usePageClamp(page, setPage, data?.totalPages);
  const toggleActivo = useToggleActivo();
  const myId = useAuthStore((s) => s.user?.userId);

  const usuarios = data?.content ?? [];
  // NOTE: search filters only the current server-fetched page (server-paginated,
  // size 20); the `Pager`'s result-count caption still reflects the unfiltered
  // page total, not the filtered count. Same root cause as BACKLOG-03.
  const filtered = search.trim()
    ? usuarios.filter(
        (u) =>
          u.nombre.toLowerCase().includes(search.trim().toLowerCase()) ||
          u.email.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : usuarios;

  const columns: Column<Usuario>[] = [
    { key: 'nombre', header: 'Nombre', render: (u) => <Text variant="body">{u.nombre}</Text> },
    { key: 'email', header: 'Email', render: (u) => <Text variant="body-sm" color="ink-3">{u.email}</Text> },
    { key: 'rol', header: 'Rol', render: (u) => <Badge tone="neutral" label={ROLE_LABEL[u.tipo] ?? u.tipo} /> },
    {
      key: 'estado',
      header: 'Estado',
      render: (u) => {
        const isErrorForThis = toggleActivo.isError && toggleActivo.variables?.id === u.id;
        return (
          <>
            <Badge {...(ACTIVO[String(u.activo)] ?? { tone: 'neutral', label: String(u.activo) })} />
            {isErrorForThis && (
              <Text color="urgent" variant="micro" style={{ display: 'block', marginTop: 4 }}>
                {mapUsuarioError(toggleActivo.error)}
              </Text>
            )}
          </>
        );
      },
    },
  ];

  return (
    <div>
      <Text variant="h1">Usuarios</Text>

      <AsyncSection
        isLoading={isLoading}
        isError={isError}
        isEmpty={usuarios.length === 0}
        emptyLabel="No hay usuarios"
      >
        <div style={{ marginTop: 20 }}>
          <PaginatedTable
            columns={columns}
            rows={filtered}
            rowKey={(u) => u.id}
            page={data ?? { number: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 0 }}
            onPageChange={setPage}
            isFetching={isFetching}
            search={{ value: search, onChange: setSearch, placeholder: 'Buscar por nombre o email' }}
            emptyLabel="No hay usuarios que coincidan con la búsqueda"
            rowActions={(u) => {
              const isSelf = u.id === myId;
              const isMutatingThis = toggleActivo.isPending && toggleActivo.variables?.id === u.id;
              return (
                <Button
                  variant={u.activo ? 'danger' : 'ok'}
                  size="sm"
                  disabled={isSelf || isMutatingThis}
                  title={isSelf ? 'No podés desactivar tu propia cuenta' : undefined}
                  onClick={() => { toggleActivo.mutate({ id: u.id, activo: !u.activo }); }}
                >
                  {u.activo ? 'Desactivar' : 'Activar'}
                </Button>
              );
            }}
          />
        </div>
      </AsyncSection>
    </div>
  );
}
