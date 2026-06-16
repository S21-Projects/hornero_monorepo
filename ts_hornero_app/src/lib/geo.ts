/**
 * Utilidades geográficas para el mapa de comedores/ONGs.
 * Sin dependencias de Leaflet ni del navegador — seguro de importar en cualquier lado.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Centro aproximado de la ciudad de Córdoba (fallback cuando no hay geolocalización). */
export const CORDOBA_CENTER: LatLng = { lat: -31.4201, lng: -64.1888 };

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distancia en kilómetros entre dos puntos (fórmula de Haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Formatea una distancia en km a texto legible: "a 850 m" / "a 1,2 km". */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `a ${Math.round(km * 1000)} m`;
  }
  return `a ${km.toFixed(1).replace(".", ",")} km`;
}

/**
 * Ordena una lista de elementos con coordenadas por cercanía a `from`.
 * Los elementos sin coordenadas válidas se mandan al final, conservando su orden relativo.
 * Devuelve copias anotadas con `distanceKm` (undefined si no hay coordenadas).
 */
export function sortByDistance<T extends { latitud?: number | null; longitud?: number | null }>(
  items: T[],
  from: LatLng,
): Array<T & { distanceKm?: number }> {
  return items
    .map((item) => {
      const hasCoords = item.latitud != null && item.longitud != null;
      const distance = hasCoords
        ? distanceKm(from, { lat: item.latitud as number, lng: item.longitud as number })
        : undefined;
      return { ...item, distanceKm: distance };
    })
    .sort((a, b) => {
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
}
