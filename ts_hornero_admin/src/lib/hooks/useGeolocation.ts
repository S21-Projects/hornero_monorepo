import { useCallback, useState } from 'react';
import { CORDOBA_CENTER, type LatLng } from '../geo';

export type GeolocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

export interface UseGeolocationResult {
  /** Current user position, or the Córdoba center as fallback. */
  position: LatLng;
  /** True when `position` comes from a granted geolocation fix (not the fallback). */
  hasUserPosition: boolean;
  status: GeolocationStatus;
  /** Increments every time a position is obtained (used to re-center the map). */
  fixCount: number;
  /** Requests (or re-requests) the browser location. `onFix` receives the obtained coords. */
  request: (onFix?: (latlng: LatLng) => void) => void;
}

/**
 * Wraps `navigator.geolocation`. Does not request permission on mount — exposes
 * `request()` to trigger it from a button ("center on my location"). Meanwhile
 * `position` falls back to the Córdoba center so the map always has a center.
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
