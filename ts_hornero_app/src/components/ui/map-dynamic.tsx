'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeafletMapProps } from '@/components/ui/leaflet-map';

/**
 * Carga el mapa Leaflet solo en el cliente (`ssr: false`): Leaflet accede a `window`.
 * En Next 16, `dynamic(..., { ssr:false })` solo se permite dentro de Client Components,
 * por eso este wrapper lleva 'use client' y es el que consumen las páginas (incluidas las
 * Server Components, que pueden importar un Client Component sin problema).
 */
const LeafletMap = dynamic(() => import('@/components/ui/leaflet-map'), {
  ssr: false,
  loading: () => <Skeleton width="100%" height="100%" borderRadius={0} />,
});

export function MapDynamic(props: LeafletMapProps) {
  return <LeafletMap {...props} />;
}

export type { MapMarkerData, LeafletMapProps } from '@/components/ui/leaflet-map';
