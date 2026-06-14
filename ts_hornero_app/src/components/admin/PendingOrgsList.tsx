'use client';

import { useState } from 'react';
import { Eye, TickCircle } from 'iconsax-reactjs';
import { isAxiosError } from 'axios';
import { Card } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';
import { Button } from '@/components/ui/button';
import { usePendingOrgsQuery } from '@/hooks/usePendingOrgsQuery';
import { useValidateOrgMutation } from '@/hooks/useValidateOrgMutation';
import { useRejectOrgMutation } from '@/hooks/useRejectOrgMutation';

export default function PendingOrgsList() {
  const { data, isLoading, isError, refetch } = usePendingOrgsQuery();
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

  const pendingCount = data?.length ?? 0;

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
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 800,
                color: 'var(--ink-2)',
              }}
            >
              Pendientes
            </span>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'var(--medium)',
              }}
            />
          </div>
          <div
            style={{
              fontSize: 38,
              fontWeight: 900,
              color: 'var(--earth)',
              marginTop: 8,
              lineHeight: 1,
            }}
          >
            {isLoading ? '…' : pendingCount}
          </div>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--ink-3)',
              marginTop: 8,
            }}
          >
            Requieren revisión
          </div>
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
            fontSize: 13.5,
            fontWeight: 700,
            color: '#DC2626',
          }}
        >
          No se pudieron cargar las organizaciones pendientes. Intentá recargar la página.
        </div>
      )}

      {/* table */}
      <Card style={{ overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2.4fr 1.3fr 1fr 1.4fr',
            gap: 12,
            padding: '16px 24px',
            borderBottom: '1px solid var(--line)',
            fontSize: 12.5,
            fontWeight: 800,
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '.04em',
          }}
        >
          <span>Organización</span>
          <span>Tipo</span>
          <span>Referente</span>
          <span style={{ textAlign: 'right' }}>Acciones</span>
        </div>

        {isLoading && (
          <div
            style={{
              padding: '32px 24px',
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--ink-3)',
            }}
          >
            Cargando…
          </div>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <div
            style={{
              padding: '32px 24px',
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--ink-3)',
            }}
          >
            No hay organizaciones pendientes de revisión.
          </div>
        )}

        {data?.map((org, i) => {
          const validateInFlight = mutation.isPending && mutation.variables === org.id;
          const rejectInFlight = rejectMutation.isPending && rejectMutation.variables === org.id;
          const inFlight = validateInFlight || rejectInFlight;
          const rowError = rowErrors[org.id];

          return (
            <div
              key={org.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2.4fr 1.3fr 1fr 1.4fr',
                gap: 12,
                padding: '14px 24px',
                borderBottom:
                  i < (data?.length ?? 0) - 1
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
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 14.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {org.nombre}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--ink-3)',
                      fontWeight: 700,
                    }}
                  >
                    <Pill variant="warn" dot>
                      Pendiente
                    </Pill>
                  </div>
                </div>
              </div>

              {/* Tipo */}
              <span>
                <Pill variant="cat">{org.tipo}</Pill>
              </span>

              {/* Referente */}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: 'var(--ink-2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {org.referenteNombre ?? '—'}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--ink-3)',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {org.referenteEmail ?? ''}
                </div>
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
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: '#DC2626',
                    }}
                  >
                    {rowError}
                  </span>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  style={{ padding: '8px 11px' }}
                >
                  <Eye size={16} color="var(--ink-2)" />
                </Button>
                <Button
                  size="sm"
                  disabled={inFlight}
                  onClick={() => handleValidate(org.id)}
                  style={{
                    background: 'var(--ok-bg)',
                    color: 'var(--ok)',
                    border: 'none',
                    cursor: inFlight ? 'not-allowed' : 'pointer',
                    gap: 6,
                    padding: '8px 12px',
                    borderRadius: 10,
                    fontFamily: 'inherit',
                    fontWeight: 800,
                    fontSize: 13.5,
                    opacity: inFlight ? 0.6 : 1,
                  }}
                >
                  <TickCircle size={16} color="var(--ok)" />
                  {validateInFlight ? 'Validando…' : 'Validar'}
                </Button>
                <Button
                  size="sm"
                  disabled={inFlight}
                  onClick={() => handleReject(org.id)}
                  style={{
                    background: '#FEE2E2',
                    color: '#DC2626',
                    border: 'none',
                    cursor: inFlight ? 'not-allowed' : 'pointer',
                    gap: 6,
                    padding: '8px 12px',
                    borderRadius: 10,
                    fontFamily: 'inherit',
                    fontWeight: 800,
                    fontSize: 13.5,
                    opacity: inFlight ? 0.6 : 1,
                  }}
                >
                  {rejectInFlight ? 'Rechazando…' : 'Rechazar'}
                </Button>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
