import { useEffect, useState } from 'react';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
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

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

/** Placeholder domain the MS gives to an anonymized account (RFC 2606 reserved TLD). */
const esAnonimo = (u: Usuario) => u.email.endsWith('@anonimo.invalid');

const CONFIRM_WORD = 'ANONIMIZAR';

interface UsuarioDrawerProps {
  usuario: Usuario;
  isSelf: boolean;
  onClose: () => void;
  onToggle: (activo: boolean, motivo: string) => void;
  onAnonimizar: () => void;
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text variant="label" color="ink-3" as="div">{label}</Text>
      <Text variant="body" as="div">{children}</Text>
    </div>
  );
}

/** Account detail with the activate/deactivate and anonymize actions (the latter needs a typed confirmation). */
function UsuarioDrawer({ usuario: u, isSelf, onClose, onToggle, onAnonimizar }: UsuarioDrawerProps) {
  const [motivo, setMotivo] = useState('');
  const [anonimizando, setAnonimizando] = useState(false);
  const [confirmacion, setConfirmacion] = useState('');

  const anonimo = esAnonimo(u);
  const restringido = isSelf || anonimo;
  const activoCfg = ACTIVO[String(u.activo)] ?? { tone: 'neutral' as const, label: String(u.activo) };

  let footer;
  if (restringido) {
    footer = <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>;
  } else if (anonimizando) {
    footer = (
      <>
        <Button type="button" variant="ghost" onClick={() => { setAnonimizando(false); setConfirmacion(''); }}>
          Volver
        </Button>
        <Button type="button" variant="danger" disabled={confirmacion !== CONFIRM_WORD} onClick={onAnonimizar}>
          Anonimizar definitivamente
        </Button>
      </>
    );
  } else {
    footer = (
      <>
        <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
        <Button type="button" variant={u.activo ? 'danger' : 'ok'} onClick={() => onToggle(!u.activo, motivo.trim())}>
          {u.activo ? 'Desactivar' : 'Activar'}
        </Button>
      </>
    );
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Usuario"
      title={u.nombre}
      status={<Badge {...activoCfg} />}
      footer={footer}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Dato label="Rol">{ROLE_LABEL[u.tipo] ?? u.tipo}</Dato>
        <Dato label="Estado">{activoCfg.label}</Dato>
        <Dato label="Email">{u.email}</Dato>

        {isSelf && (
          <InfoBox>No podés modificar tu propia cuenta (desactivarla o anonimizarla) desde acá.</InfoBox>
        )}
        {!isSelf && anonimo && <InfoBox>Esta cuenta ya fue anonimizada y no se puede modificar.</InfoBox>}

        {!restringido && !anonimizando && (
          <>
            <Input
              id={`usuario-motivo-${u.id}`}
              label="Motivo (opcional)"
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
              <Text variant="label" color="urgent" as="div">Zona de peligro</Text>
              <Text variant="body-sm" color="ink-3" as="div" style={{ margin: '4px 0 10px' }}>
                Derecho de supresión: reemplaza los datos personales de la cuenta.
              </Text>
              <Button type="button" variant="secondary" size="sm" onClick={() => setAnonimizando(true)}>
                Anonimizar
              </Button>
            </div>
          </>
        )}

        {!restringido && anonimizando && (
          <div
            role="alertdialog"
            aria-labelledby={`anonimizar-titulo-${u.id}`}
            aria-describedby={`anonimizar-detalle-${u.id}`}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <Text id={`anonimizar-titulo-${u.id}`} variant="body" style={{ fontWeight: 600 }}>
              ¿Anonimizar a {u.nombre}?
            </Text>
            <Text id={`anonimizar-detalle-${u.id}`} variant="body-sm" color="ink-3">
              Esta acción no se puede deshacer. Se reemplazan el nombre y el email por datos genéricos,
              se desactiva la cuenta y se cierran sus sesiones. Las donaciones y el registro de
              actividades se conservan, sin datos que identifiquen a la persona.
            </Text>
            <Input
              id={`usuario-anonimizar-${u.id}`}
              label={`Escribí ${CONFIRM_WORD} para confirmar`}
              value={confirmacion}
              autoComplete="off"
              onChange={(e) => setConfirmacion(e.target.value)}
            />
          </div>
        )}
      </div>
    </Drawer>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 'var(--r-input)', background: 'var(--card-2)', border: '1px solid var(--line)' }}>
      <Text variant="body-sm" color="ink-2">{children}</Text>
    </div>
  );
}

export default function UsersPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data, isLoading, isError, isFetching } = useUsuarios({ page, size: pageSize, q });
  usePageClamp(page, setPage, data?.totalPages);
  const toggleActivo = useToggleActivo();
  const anonimizar = useAnonimizarUsuario();
  const myId = useAuthStore((s) => s.user?.userId);

  const usuarios = data?.content ?? [];
  const selected = usuarios.find((u) => u.id === selectedId) ?? null;

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
            page={data ?? { number: 0, size: pageSize, totalElements: 0, totalPages: 0 }}
            onPageChange={setPage}
            isFetching={isFetching}
            search={{ value: search, onChange: setSearch, placeholder: 'Buscar por nombre o email' }}
            emptyLabel="No hay usuarios que coincidan con la búsqueda"
            onRowClick={(u) => setSelectedId(u.id)}
            selectedKey={selectedId ?? undefined}
            pageSize={pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(0); }}
          />
        </div>
      </AsyncSection>

      {selected && (
        <UsuarioDrawer
          key={selected.id}
          usuario={selected}
          isSelf={selected.id === myId}
          onClose={() => setSelectedId(null)}
          onToggle={(activo, motivo) => {
            toggleActivo.mutate(motivo ? { id: selected.id, activo, motivo } : { id: selected.id, activo });
            setSelectedId(null);
          }}
          onAnonimizar={() => {
            anonimizar.mutate(selected.id);
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
