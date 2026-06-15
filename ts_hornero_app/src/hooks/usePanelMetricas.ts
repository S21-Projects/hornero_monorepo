'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { fetchAllNecesidades, fetchAllDonaciones } from '@/lib/api/donaciones.server';
import { fetchValidatedOrganizaciones, getPendingOrganizaciones } from '@/lib/api/organizaciones';
import { getUsuarios } from '@/lib/api/usuarios';

export function usePanelMetricas() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.tipo === 'ADMINISTRADOR';

  const organizaciones = useQuery({
    queryKey: ['metricas', 'organizaciones'],
    queryFn: fetchValidatedOrganizaciones,
    staleTime: 60_000,
  });

  const pendientes = useQuery({
    queryKey: ['metricas', 'organizaciones-pendientes'],
    queryFn: getPendingOrganizaciones,
    staleTime: 60_000,
    enabled: isAdmin,
  });

  const necesidades = useQuery({
    queryKey: ['metricas', 'necesidades'],
    queryFn: fetchAllNecesidades,
    staleTime: 60_000,
  });

  const donaciones = useQuery({
    queryKey: ['metricas', 'donaciones'],
    queryFn: fetchAllDonaciones,
    staleTime: 60_000,
  });

  const usuarios = useQuery({
    queryKey: ['metricas', 'usuarios'],
    queryFn: getUsuarios,
    staleTime: 60_000,
    enabled: isAdmin,
  });

  const isLoading =
    organizaciones.isLoading || necesidades.isLoading || donaciones.isLoading ||
    (isAdmin && (pendientes.isLoading || usuarios.isLoading));

  const isError =
    organizaciones.isError || necesidades.isError || donaciones.isError;

  const refetch = () => {
    organizaciones.refetch();
    necesidades.refetch();
    donaciones.refetch();
    if (isAdmin) {
      pendientes.refetch();
      usuarios.refetch();
    }
  };

  return {
    isAdmin,
    isLoading,
    isError,
    refetch,
    organizaciones: organizaciones.data ?? [],
    pendientes: pendientes.data ?? [],
    necesidades: necesidades.data ?? [],
    donaciones: donaciones.data ?? [],
    usuarios: usuarios.data ?? [],
  };
}
