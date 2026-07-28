/**
 * Geographic utilities for the organization map.
 * No Leaflet or browser dependencies — safe to import anywhere (server + client).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Approximate center of Córdoba city (fallback when geolocation is unavailable). */
export const CORDOBA_CENTER: LatLng = { lat: -31.4201, lng: -64.1888 };

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distance in kilometers between two points (Haversine formula). */
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

/** Formats a distance in km to readable text: "a 850 m" / "a 1,2 km". */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `a ${Math.round(km * 1000)} m`;
  }
  return `a ${km.toFixed(1).replace('.', ',')} km`;
}

/**
 * Sorts items with coordinates by proximity to `from`.
 * Items without valid coordinates go to the end, preserving their relative order.
 * Returns annotated copies with `distanceKm` (undefined if no coordinates).
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
