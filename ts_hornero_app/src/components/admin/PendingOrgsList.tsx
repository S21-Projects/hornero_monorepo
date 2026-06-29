'use client';

import { useState } from 'react';
import { Eye, TickCircle } from 'iconsax-reactjs';
import { isAxiosError } from 'axios';
import { Card } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';
import { usePendingOrgsQuery } from '@/hooks/usePendingOrgsQuery';
import { TIPO_ORGANIZACION_LABELS, type TipoOrganizacion } from '@/lib/tipos-organizacion';
import { useValidateOrgMutation } from '@/hooks/useValidateOrgMutation';
import { useRejectOrgMutation } from '@/hooks/useRejectOrgMutation';
import { Pager } from '@/components/ui/Pager';

export default function PendingOrgsList() {
  const [page, setPage] = useState(0);
  const { data, isLoading, isError, refetch } = usePendingOrgsQuery(page, 20);
  const orgs = data?.content ?? [];
  const mutation = useValidateOrgMutation();
  const rejectMutation = useRejectOrgMutation();
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  function handleValidate(id: number) {
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    mutation.mutate(id, {
      onError: (err) => {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        if (status === 409) {
          setRowErrors((prev) => ({ ...prev, [id]: 'Ya validada' }));
          refetch();
        }
      },
    });
  }

  function handleReject(id: number) {
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    rejectMutation.mutate(id, {
      onError: (err) => {
        const msg = isAxiosError(err) && err.response?.status === 409
          ? 'Ya procesada'
          : 'Error al rechazar';
        setRowErrors((prev) => ({ ...prev, [id]: msg }));
        refetch();
      },
    });
  }

  const pendingCount = data?.totalElements ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* stats */}
      <div style={{ display: 'flex', gap: 18 }}>
        <Card style={{ flex: 1, padding: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text as="span" variant="label" color="ink-2">Pendientes</Text>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'var(--medium)',
              }}
            />
          </div>
          <Text as="div" variant="stat" color="earth" style={{ marginTop: 8 }}>
            {isLoading ? '…' : pendingCount}
          </Text>
          <Text as="div" variant="caption" color="ink-3" style={{ marginTop: 8 }}>
            Requieren revisión
          </Text>
        </Card>
      </div>

      {/* error banner */}
      {isError && (
        <div
          style={{
            background: '#FEE2E2',
            border: '1px solid #FCA5A5',
            borderRadius: 10,
            padding: '10px 14px',
          }}
        >
          <Text variant="label" style={{ color: '#DC2626' }}>
            No se pudieron cargar las organizaciones pendientes. Intentá recargar la página.
          </Text>
        </div>
      )}

      {/* table */}
      <Card style={{ overflow: 'hidden' }}>
        <div className="overflow-x-auto">
        <div
          className="min-w-[640px]"
          style={{
            display: 'grid',
            gridTemplateColumns: '2.4fr 1.3fr 1fr 1.4fr',
            gap: 12,
            padding: '16px 24px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <Text as="span" variant="caption" color="ink-3" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Organización</Text>
          <Text as="span" variant="caption" color="ink-3" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Tipo</Text>
          <Text as="span" variant="caption" color="ink-3" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Referente</Text>
          <Text as="span" variant="caption" color="ink-3" style={{ textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.04em' }}>Acciones</Text>
        </div>

        {isLoading && [0, 1, 2].map((i) => (
          <div
            key={i}
            className="min-w-[640px]"
            style={{
              display: 'grid',
              gridTemplateColumns: '2.4fr 1.3fr 1fr 1.4fr',
              gap: 12,
              padding: '14px 24px',
              borderBottom: i < 2 ? '1px solid var(--line-soft)' : 'none',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Skeleton width={40} height={40} borderRadius={10} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Skeleton width={160} height={13} />
                <Skeleton width={80} height={20} borderRadius={999} />
              </div>
            </div>
            <Skeleton width={80} height={24} borderRadius={999} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Skeleton width={100} height={13} />
              <Skeleton width={120} height={11} />
            </div>
            <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
              <Skeleton width={34} height={32} borderRadius={8} />
              <Skeleton width={80} height={32} borderRadius={8} />
              <Skeleton width={80} height={32} borderRadius={8} />
            </div>
          </div>
        ))}

        {!isLoading && !isError && orgs.length === 0 && (
          <div
            style={{
              padding: '48px 24px',
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
                <path d="M5 14c0-4 3-7 7-7 2 0 4 1 4 1l3-2-1 3s1 2 1 4c0 4-3 7-7 7" />
                <circle cx="10" cy="11" r="1" fill="var(--horn)" stroke="none" />
              </svg>
            </div>
            <Text as="div" variant="title" color="earth">Todo al día</Text>
            <Text as="div" variant="label" color="ink-3">No hay organizaciones pendientes de revisión.</Text>
          </div>
        )}

        {orgs.map((org, i) => {
          const validateInFlight = mutation.isPending && mutation.variables === org.id;
          const rejectInFlight = rejectMutation.isPending && rejectMutation.variables === org.id;
          const inFlight = validateInFlight || rejectInFlight;
          const rowError = rowErrors[org.id];

          return (
            <div
              key={org.id}
              className="min-w-[640px]"
              style={{
                display: 'grid',
                gridTemplateColumns: '2.4fr 1.3fr 1fr 1.4fr',
                gap: 12,
                padding: '14px 24px',
                borderBottom:
                  i < orgs.length - 1
                    ? '1px solid var(--line-soft)'
                    : 'none',
                alignItems: 'center',
              }}
            >
              {/* Org name */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'var(--card-2)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg
                    width={22}
                    height={22}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--horn)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 14c0-4 3-7 7-7 2 0 4 1 4 1l3-2-1 3s1 2 1 4c0 4-3 7-7 7" />
                    <circle cx="10" cy="11" r="1" fill="var(--horn)" stroke="none" />
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <Text
                    as="div"
                    variant="body-sm"
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {org.nombre}
                  </Text>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 700 }}>
                    <Pill variant="warn" dot>
                      Pendiente
                    </Pill>
                  </div>
                </div>
              </div>

              {/* Tipo */}
              <span>
                <Pill variant="cat">{TIPO_ORGANIZACION_LABELS[org.tipo as TipoOrganizacion] ?? org.tipo}</Pill>
              </span>

              {/* Referente */}
              <div style={{ minWidth: 0 }}>
                <Text
                  as="div"
                  variant="body-sm"
                  color="ink-2"
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {org.referenteNombre ?? '—'}
                </Text>
                <Text
                  as="div"
                  variant="caption"
                  color="ink-3"
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {org.referenteEmail ?? ''}
                </Text>
              </div>

              {/* Actions */}
              <div
                style={{
                  display: 'flex',
                  gap: 7,
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                }}
              >
                {rowError && (
                  <Text as="span" variant="caption" style={{ color: '#DC2626' }}>
                    {rowError}
                  </Text>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  style={{ padding: '8px 11px' }}
                >
                  <Eye size={16} color="var(--ink-2)" />
                </Button>
                <Button
                  variant="ok"
                  size="sm"
                  loading={validateInFlight}
                  disabled={inFlight}
                  onClick={() => handleValidate(org.id)}
                >
                  <TickCircle size={16} color="#fff" />
                  Validar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  loading={rejectInFlight}
                  disabled={inFlight}
                  onClick={() => handleReject(org.id)}
                >
                  Rechazar
                </Button>
              </div>
            </div>
          );
        })}
        </div>
      </Card>

      {data && data.totalPages > 1 && (
        <Pager
          page={page}
          totalPages={data.totalPages}
          totalElements={data.totalElements}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
