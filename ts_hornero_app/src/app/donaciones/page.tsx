'use client';

import { TopBar } from '@/components/ui/top-bar';
import { ErrorState } from '@/components/ui/error-state';
import { NeedsBoard } from '@/components/needs/needs-board';
import { useNecesidades } from '@/lib/hooks/useNecesidades';
import { useValidatedOrganizaciones } from '@/lib/hooks/useValidatedOrganizaciones';

export default function DonacionesPage() {
  const { data: necesidades, isPending, isError, refetch } = useNecesidades();
  const { data: orgs } = useValidatedOrganizaciones();

  const orgMap = new Map(orgs?.map((o) => [o.id, o.nombre]) ?? []);
  const count = necesidades?.length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar active="Donaciones" />
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 40px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 22,
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900 }}>Necesidades</h1>
            <p style={{ color: 'var(--ink-2)', fontSize: 15, marginTop: 5, fontWeight: 600 }}>
              {isPending
                ? 'Cargando...'
                : `${count} ${count === 1 ? 'necesidad publicada' : 'necesidades publicadas'} de comedores de Córdoba`}
            </p>
          </div>
        </div>

        {isError ? (
          <ErrorState
            onRetry={() => refetch()}
            message="No pudimos cargar las necesidades. Intentá de nuevo."
          />
        ) : (
          <NeedsBoard
            necesidades={necesidades ?? []}
            isLoading={isPending}
            orgMap={orgMap}
          />
        )}
      </div>
    </div>
  );
}
