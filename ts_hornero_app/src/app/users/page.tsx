'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Add, More, TickSquare } from 'iconsax-reactjs';
import { AdminShell } from '@/components/ui/admin-shell';
import { Card } from '@/components/ui/card';
import { Pill, type PillVariant } from '@/components/ui/pill';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/typography';
import { useAuthStore } from '@/store/auth.store';
import { ROLE_LABELS } from '@/lib/roles';
import { useUsuariosQuery } from '@/hooks/useUsuariosQuery';
import { toggleActivo } from '@/lib/api/usuarios';
import { Pager } from '@/components/ui/Pager';

const ROLE_PILL: Record<string, { variant: PillVariant; label: string }> = {
  ADMINISTRADOR: { variant: 'role-super', label: ROLE_LABELS.ADMINISTRADOR },
  REFERENTE:     { variant: 'role-org',   label: ROLE_LABELS.REFERENTE },
  DONANTE:       { variant: 'role-donor', label: ROLE_LABELS.DONANTE },
};

function getRolePill(tipo: string): { variant: PillVariant; label: string } {
  return ROLE_PILL[tipo] ?? { variant: 'role-donor', label: tipo };
}

export default function UsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuthStore();
  const [page, setPage] = useState(0);
  const { data, isLoading, isError, refetch } = useUsuariosQuery(page, 20);

  const users = data?.content ?? [];
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user && user.tipo !== 'ADMINISTRADOR') {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleBulk(activo: boolean) {
    setBulkLoading(true);
    setBulkError(null);
    try {
      await Promise.all([...selected].map(id => toggleActivo(id, activo)));
      setSelected(new Set());
    } catch {
      setBulkError('Algunos cambios no pudieron aplicarse. Intentá de nuevo.');
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setBulkLoading(false);
    }
  }

  return (
    <AdminShell
      active="Usuarios"
      title="Gestión de usuarios"
      subtitle="Administrá roles, permisos y estados de las cuentas de la plataforma"
      actions={
        <Button variant="primary" style={{ gap: 8 }}>
          <Add size={18} color="#fff" /> Invitar usuario
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* bulk bar — only when selection is non-empty */}
        {selected.size > 0 && (
          <Card
            style={{
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              background: 'var(--straw)',
              boxShadow: 'none',
            }}
          >
            <Text as="span" variant="body-sm" color="earth">
              {selected.size} seleccionados
            </Text>
            <div style={{ flex: 1 }} />
            {bulkError && (
              <Text as="span" variant="label" color="urgent">
                {bulkError}
              </Text>
            )}
            <Button
              variant="secondary"
              size="sm"
              loading={bulkLoading}
              onClick={() => handleBulk(true)}
            >
              Activar
            </Button>
            <Button variant="danger" size="sm" loading={bulkLoading} onClick={() => handleBulk(false)}>Desactivar</Button>
          </Card>
        )}

        {/* table */}
        <div className="overflow-x-auto">
        <Card>
          {/* header */}
          <div
            className="hidden sm:grid gap-3 px-6 py-[15px] items-center"
            style={{
              gridTemplateColumns: '36px 2.4fr 1.7fr 1fr 1fr 60px',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <span
              style={{
                width: 19,
                height: 19,
                borderRadius: 6,
                border: '2px solid var(--line)',
                display: 'inline-block',
              }}
            />
            <Text as="span" variant="caption" color="ink-3" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Usuario</Text>
            <Text as="span" variant="caption" color="ink-3" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Rol</Text>
            <Text as="span" variant="caption" color="ink-3" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Estado</Text>
            <Text as="span" variant="caption" color="ink-3" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Actividad</Text>
            <span />
          </div>

          {/* body states */}
          {isLoading && [0, 1, 2].map((i) => (
            <div
              key={i}
              className="hidden sm:grid gap-3 px-6 py-[13px] items-center"
              style={{
                gridTemplateColumns: '36px 2.4fr 1.7fr 1fr 1fr 60px',
                borderBottom: i < 2 ? '1px solid var(--line-soft)' : 'none',
              }}
            >
              <Skeleton width={19} height={19} borderRadius={6} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Skeleton width={42} height={42} borderRadius="50%" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton width={140} height={13} />
                  <Skeleton width={100} height={11} />
                </div>
              </div>
              <Skeleton width={80} height={24} borderRadius={999} />
              <Skeleton width={60} height={13} />
              <Skeleton width={70} height={13} />
              <Skeleton width={28} height={28} borderRadius={8} />
            </div>
          ))}

          {isError && !isLoading && (
            <ErrorState
              title="Error al cargar usuarios"
              message="No se pudieron cargar los usuarios. Verificá tu conexión e intentá de nuevo."
              onRetry={refetch}
            />
          )}

          {!isLoading && !isError && users.length === 0 && (
            <div
              style={{
                padding: '56px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'var(--straw)',
                  border: '1.5px dashed var(--horn)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 4,
                }}
              >
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--horn)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <Text as="div" variant="title" color="earth">No hay usuarios registrados</Text>
              <Text as="div" variant="label" color="ink-3">Los usuarios aparecerán acá cuando se registren en la plataforma.</Text>
            </div>
          )}

          {!isLoading && !isError && users.length > 0 &&
            users.map((u, i) => {
              const { variant, label } = getRolePill(u.tipo);
              const sel = selected.has(u.id);
              return (
                <div
                  key={u.id}
                  className="hidden sm:grid gap-3 px-6 py-[13px] items-center"
                  style={{
                    gridTemplateColumns: '36px 2.4fr 1.7fr 1fr 1fr 60px',
                    borderBottom: i < users.length - 1 ? '1px solid var(--line-soft)' : 'none',
                    background: sel ? '#FBF1E2' : 'transparent',
                  }}
                >
                  <span
                    onClick={() => toggleSelect(u.id)}
                    style={{
                      width: 19,
                      height: 19,
                      borderRadius: 6,
                      border: sel ? 'none' : '2px solid var(--line)',
                      background: sel ? 'var(--horn)' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      cursor: 'pointer',
                    }}
                  >
                    {sel && <TickSquare size={13} color="#fff" variant="Bold" />}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <Avatar name={u.nombre} size={42} tintIndex={i} />
                    <div style={{ minWidth: 0 }}>
                      <Text as="div" variant="body-sm">{u.nombre}</Text>
                      <Text as="div" variant="caption" color="ink-3">{u.email}</Text>
                    </div>
                  </div>

                  <span>
                    <Pill variant={variant}>{label}</Pill>
                  </span>

                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: u.activo ? 'var(--ok)' : 'var(--ink-3)',
                      }}
                    />
                    <Text as="span" variant="label" color={u.activo ? 'ok' : 'ink-3'}>{u.activo ? 'Activo' : 'Inactivo'}</Text>
                  </span>

                  <Text as="span" variant="label" color="ink-2">—</Text>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="ghost" size="sm" style={{ padding: '8px 10px' }}>
                      <More size={18} color="var(--ink-3)" />
                    </Button>
                  </div>
                </div>
              );
            })
          }
        </Card>
        </div>

        {data && data.totalPages > 1 && (
          <Pager
            page={page}
            totalPages={data.totalPages}
            totalElements={data.totalElements}
            onPageChange={setPage}
          />
        )}

        {/* Mobile card-list — sm:hidden */}
        <div className="sm:hidden space-y-3">
          {!isLoading && !isError && users.length > 0 && users.map((u, i) => {
            const { variant, label } = getRolePill(u.tipo);
            const sel = selected.has(u.id);
            return (
              <Card
                key={u.id}
                style={{
                  padding: '14px 16px',
                  background: sel ? '#FBF1E2' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    onClick={() => toggleSelect(u.id)}
                    style={{
                      width: 19,
                      height: 19,
                      borderRadius: 6,
                      border: sel ? 'none' : '2px solid var(--line)',
                      background: sel ? 'var(--horn)' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      cursor: 'pointer',
                    }}
                  >
                    {sel && <TickSquare size={13} color="#fff" variant="Bold" />}
                  </span>
                  <Avatar name={u.nombre} size={42} tintIndex={i} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text as="div" variant="body-sm">{u.nombre}</Text>
                    <Text as="div" variant="caption" color="ink-3">{u.email}</Text>
                  </div>
                  <Button variant="ghost" size="sm" style={{ padding: '8px 10px', flexShrink: 0 }}>
                    <More size={18} color="var(--ink-3)" />
                  </Button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                  <Pill variant={variant}>{label}</Pill>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: u.activo ? 'var(--ok)' : 'var(--ink-3)',
                      }}
                    />
                    <Text as="span" variant="label" color={u.activo ? 'ok' : 'ink-3'}>{u.activo ? 'Activo' : 'Inactivo'}</Text>
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
