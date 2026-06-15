'use client';

import { useCallback, useState } from 'react';
import { CORDOBA_CENTER, type LatLng } from '@/lib/geo';

export type GeolocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

export interface UseGeolocationResult {
  /** Posición actual del usuario, o el centro de Córdoba como fallback. */
  position: LatLng;
  /** True cuando `position` proviene de una geolocalización concedida (no el fallback). */
  hasUserPosition: boolean;
  status: GeolocationStatus;
  /** Contador que se incrementa cada vez que se obtiene una posición (para recentrar el mapa). */
  fixCount: number;
  /** Pide (o vuelve a pedir) la ubicación al navegador. `onFix` recibe las coordenadas obtenidas. */
  request: (onFix?: (latlng: LatLng) => void) => void;
}

/**
 * Envuelve `navigator.geolocation`. No pide permiso al montar; expone `request()`
 * para dispararlo desde un botón ("centrar en mi ubicación"). Mientras tanto
 * `position` cae al centro de Córdoba para que el mapa siempre tenga centro.
 */
export function useGeolocation(): UseGeolocationResult {
  const [position, setPosition] = useState<LatLng>(CORDOBA_CENTER);
  const [hasUserPosition, setHasUserPosition] = useState(false);
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [fixCount, setFixCount] = useState(0);

  const request = useCallback((onFix?: (latlng: LatLng) => void) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported');
      return;
    }

    setStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(latlng);
        setHasUserPosition(true);
        setStatus('granted');
        setFixCount((n) => n + 1);
        onFix?.(latlng);
      },
      () => {
        setStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  return { position, hasUserPosition, status, fixCount, request };
}
