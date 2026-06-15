'use client';

import { useMemo } from 'react';
import { MapDynamic, type MapMarkerData } from '@/components/ui/map-dynamic';
import { useValidatedOrganizaciones } from '@/lib/hooks/useValidatedOrganizaciones';
import { CORDOBA_CENTER } from '@/lib/geo';

/**
 * Mapa de "Zonas de interés" en Preferencias: muestra los comedores/ONGs validados
 * sobre un mapa real de Córdoba. Las zonas (chips) no tienen coordenadas en el modelo,
 * así que el mapa solo ubica las organizaciones existentes.
 */
export function ZonasMap({ height = 190 }: { height?: number }) {
  const { data: orgs } = useValidatedOrganizaciones();

  const markers = useMemo<MapMarkerData[]>(
    () =>
      (orgs ?? [])
        .filter((o) => o.latitud != null && o.longitud != null)
        .map((o) => ({
          id: o.id,
          lat: o.latitud as number,
          lng: o.longitud as number,
          label: o.nombre,
          sub: o.direccion,
        })),
    [orgs],
  );

  return (
    <MapDynamic
      markers={markers}
      center={CORDOBA_CENTER}
      zoom={12}
      height={height}
      fitToMarkers
    />
  );
}
