import { useEffect, useState } from 'react';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PaginatedTable } from '../components/ui/PaginatedTable';
import type { Column } from '../components/ui/PaginatedTable';
import { useUsuarios } from '../lib/hooks/useUsuarios';
import { useToggleActivo } from '../lib/hooks/useToggleActivo';
import { useAnonimizarUsuario } from '../lib/hooks/useAnonimizarUsuario';
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
const SEARCH_DEBOUNCE_MS = 300;

/** Placeholder domain the MS gives to an anonymized account (RFC 2606 reserved TLD). */
const esAnonimo = (u: Usuario) => u.email.endsWith('@anonimo.invalid');

export default function UsersPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [pendiente, setPendiente] = useState<{ id: number; activo: boolean } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [anonimizando, setAnonimizando] = useState<number | null>(null);
  const { data, isLoading, isError, isFetching } = useUsuarios({ page, size: PAGE_SIZE, q });
  usePageClamp(page, setPage, data?.totalPages);
  const toggleActivo = useToggleActivo();
  const anonimizar = useAnonimizarUsuario();
  const myId = useAuthStore((s) => s.user?.userId);

  const usuarios = data?.content ?? [];

  // Debounce the search into the server `q` param (covers every user, not just this page);
  // back to the first page whenever it changes.
  useEffect(() => {
    const handle = setTimeout(() => {
      setQ(search.trim());
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search]);

  const columns: Column<Usuario>[] = [
    { key: 'nombre', header: 'Nombre', render: (u) => <Text variant="body">{u.nombre}</Text> },
    { key: 'email', header: 'Email', render: (u) => <Text variant="body-sm" color="ink-3">{u.email}</Text> },
    { key: 'rol', header: 'Rol', render: (u) => <Badge tone="neutral" label={ROLE_LABEL[u.tipo] ?? u.tipo} /> },
    {
      key: 'estado',
      header: 'Estado',
      render: (u) => {
        const isErrorForThis = toggleActivo.isError && toggleActivo.variables?.id === u.id;
        const isAnonErrorForThis = anonimizar.isError && anonimizar.variables === u.id;
        return (
          <>
            <Badge {...(ACTIVO[String(u.activo)] ?? { tone: 'neutral', label: String(u.activo) })} />
            {isErrorForThis && (
              <Text color="urgent" variant="micro" style={{ display: 'block', marginTop: 4 }}>
                {mapUsuarioError(toggleActivo.error)}
              </Text>
            )}
            {isAnonErrorForThis && (
              <Text color="urgent" variant="micro" style={{ display: 'block', marginTop: 4 }}>
                {mapUsuarioError(anonimizar.error)}
              </Text>
            )}
          </>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Consultá y gestioná las cuentas de todos los usuarios de la plataforma."
      />

      <AsyncSection
        isLoading={isLoading}
        isError={isError}
        // With an active search keep the table (and its search box) on screen so it can be cleared.
        isEmpty={usuarios.length === 0 && !q}
        emptyLabel="No hay usuarios"
      >
        <div style={{ marginTop: 20 }}>
          <PaginatedTable
            columns={columns}
            rows={usuarios}
            rowKey={(u) => u.id}
            page={data ?? { number: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 0 }}
            onPageChange={setPage}
            isFetching={isFetching}
            search={{ value: search, onChange: setSearch, placeholder: 'Buscar por nombre o email' }}
            emptyLabel="No hay usuarios que coincidan con la búsqueda"
            expandedKeys={new Set<number>([...(pendiente ? [pendiente.id] : []), ...(anonimizando !== null ? [anonimizando] : [])])}
            renderRowDetail={(u) =>
              anonimizando === u.id ? (
                <div
                  role="alertdialog"
                  aria-labelledby={`anonimizar-titulo-${u.id}`}
                  aria-describedby={`anonimizar-detalle-${u.id}`}
                  style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '8px 4px' }}
                >
                  <div style={{ flex: '1 1 320px' }}>
                    <Text id={`anonimizar-titulo-${u.id}`} variant="body" style={{ fontWeight: 600 }}>
                      ¿Anonimizar a {u.nombre}?
                    </Text>
                    <Text id={`anonimizar-detalle-${u.id}`} variant="body-sm" color="ink-3" style={{ display: 'block' }}>
                      Esta acción no se puede deshacer. Se reemplazan el nombre y el email por datos genéricos,
                      se desactiva la cuenta y se cierran sus sesiones. Las donaciones y el registro de
                      actividades se conservan, sin datos que identifiquen a la persona.
                    </Text>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      anonimizar.mutate(u.id);
                      setAnonimizando(null);
                    }}
                  >
                    Anonimizar definitivamente
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => { setAnonimizando(null); }}>
                    Cancelar
                  </Button>
                </div>
              ) : pendiente?.id === u.id ? (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', padding: '8px 4px' }}>
                  <Input
                    id={`usuario-motivo-${u.id}`}
                    label="Motivo (opcional)"
                    maxLength={500}
                    value={motivo}
                    onChange={(e) => { setMotivo(e.target.value); }}
                    style={{ minWidth: 280 }}
                  />
                  <Button
                    variant={pendiente.activo ? 'ok' : 'danger'}
                    size="sm"
                    onClick={() => {
                      const m = motivo.trim();
                      toggleActivo.mutate(
                        m ? { id: u.id, activo: pendiente.activo, motivo: m } : { id: u.id, activo: pendiente.activo },
                      );
                      setPendiente(null);
                    }}
                  >
                    Confirmar
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => { setPendiente(null); }}>
                    Cancelar
                  </Button>
                </div>
              ) : null
            }
            rowActions={(u) => {
              const isSelf = u.id === myId;
              const isMutatingThis = toggleActivo.isPending && toggleActivo.variables?.id === u.id;
              const anonimo = esAnonimo(u);
              const isAnonimizandoThis = anonimizar.isPending && anonimizar.variables === u.id;
              return (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button
                    variant={u.activo ? 'danger' : 'ok'}
                    size="sm"
                    disabled={isSelf || isMutatingThis || anonimo}
                    title={isSelf ? 'No podés desactivar tu propia cuenta' : undefined}
                    onClick={() => { setAnonimizando(null); setMotivo(''); setPendiente({ id: u.id, activo: !u.activo }); }}
                  >
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isSelf || anonimo || isAnonimizandoThis}
                    title={
                      isSelf ? 'No podés anonimizar tu propia cuenta'
                        : anonimo ? 'Esta cuenta ya fue anonimizada'
                        : 'Derecho de supresión: reemplaza los datos personales de la cuenta'
                    }
                    onClick={() => { setPendiente(null); setAnonimizando(u.id); }}
                  >
                    Anonimizar
                  </Button>
                </div>
              );
            }}
          />
        </div>
      </AsyncSection>
    </div>
  );
}
