/**
 * Minimal geo utilities for the organización location picker.
 * No Leaflet/browser dependency — safe to import anywhere.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Approximate center of the city of Córdoba (fallback when there is no geolocation). */
export const CORDOBA_CENTER: LatLng = { lat: -31.4201, lng: -64.1888 };
