'use client';

import { TopBar } from '@/components/ui/top-bar';
import { ErrorState } from '@/components/ui/error-state';
import { NeedsBoard } from '@/components/needs/needs-board';
import { Text } from '@/components/ui/typography';
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
      <div className="flex-1 overflow-auto px-4 py-7 sm:px-10">
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 22,
          }}
        >
          <div>
            <Text variant="h1">Necesidades</Text>
            <Text variant="body" color="ink-2" style={{ marginTop: 5 }}>
              {isPending
                ? 'Cargando...'
                : `${count} ${count === 1 ? 'necesidad publicada' : 'necesidades publicadas'} de comedores de Córdoba`}
            </Text>
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
