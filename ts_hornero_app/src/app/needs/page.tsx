'use client';

import { useState } from 'react';
import { TopBar } from '@/components/ui/top-bar';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { NeedsBoard } from '@/components/needs/needs-board';
import { useNecesidades } from '@/lib/hooks/useNecesidades';
import { useValidatedOrganizaciones } from '@/lib/hooks/useValidatedOrganizaciones';
import { useCreateNecesidad } from '@/lib/hooks/useCreateNecesidad';
import { useAuthStore } from '@/store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { getMiOrganizacion } from '@/lib/api/organizaciones';

const PRIORIDAD_OPTIONS = ['URGENTE', 'MEDIA', 'NORMAL'] as const;
type Prioridad = (typeof PRIORIDAD_OPTIONS)[number];

const PRIORIDAD_LABELS: Record<Prioridad, string> = {
  URGENTE: 'Urgente',
  MEDIA: 'Media',
  NORMAL: 'Normal',
};

interface CreateFormState {
  descripcion: string;
  prioridad: Prioridad;
  fechaVencimiento: string;
}

const EMPTY_FORM: CreateFormState = {
  descripcion: '',
  prioridad: 'NORMAL',
  fechaVencimiento: '',
};

export default function NeedsPage() {
  const user = useAuthStore((s) => s.user);
  const { data: necesidades, isPending: loadingNeeds, isError, refetch } = useNecesidades();
  const { data: orgs } = useValidatedOrganizaciones();
  const { data: miOrg } = useQuery({
    queryKey: ['organizaciones', 'mia'],
    queryFn: getMiOrganizacion,
    enabled: user?.tipo === 'REFERENTE',
    staleTime: 60_000,
  });
  const { mutate: crearNecesidad, isPending: creating, error: createError } = useCreateNecesidad();

  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  const orgMap = new Map(orgs?.map((o) => [o.id, o.nombre]) ?? []);

  const ownNeeds = miOrg
    ? (necesidades ?? []).filter((n) => n.organizacionId === miOrg.id)
    : [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    crearNecesidad(
      {
        descripcion: form.descripcion,
        prioridad: form.prioridad,
        ...(form.fechaVencimiento ? { fechaVencimiento: form.fechaVencimiento } : {}),
      },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          setShowForm(false);
        },
      },
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar active="Necesidades" />
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 40px' }}>
        {/* header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 22,
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900 }}>Mis necesidades</h1>
            <p style={{ color: 'var(--ink-2)', fontSize: 15, marginTop: 5, fontWeight: 600 }}>
              {miOrg ? miOrg.nombre : 'Organización'}
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'Cancelar' : '+ Nueva necesidad'}
          </Button>
        </div>

        {/* create form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 14,
              padding: 24,
              marginBottom: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              maxWidth: 560,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>
                Descripción *
              </label>
              <textarea
                required
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                rows={3}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 14,
                  fontWeight: 600,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
                placeholder="¿Qué necesita la organización?"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>
                Prioridad *
              </label>
              <select
                value={form.prioridad}
                onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value as Prioridad }))}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                }}
              >
                {PRIORIDAD_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {PRIORIDAD_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>
                Fecha de vencimiento (opcional)
              </label>
              <input
                type="date"
                value={form.fechaVencimiento}
                onChange={(e) => setForm((f) => ({ ...f, fechaVencimiento: e.target.value }))}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {createError && (
              <p style={{ color: 'var(--error)', fontSize: 13, fontWeight: 600 }}>
                No se pudo crear la necesidad. Intentá de nuevo.
              </p>
            )}

            <Button variant="primary" size="sm" type="submit" disabled={creating}>
              {creating ? 'Publicando...' : 'Publicar necesidad'}
            </Button>
          </form>
        )}

        {/* own-org needs list */}
        {isError ? (
          <ErrorState
            onRetry={() => refetch()}
            message="No pudimos cargar las necesidades. Intentá de nuevo."
          />
        ) : (
          <NeedsBoard
            necesidades={ownNeeds}
            isLoading={loadingNeeds}
            orgMap={orgMap}
          />
        )}
      </div>
    </div>
  );
}
