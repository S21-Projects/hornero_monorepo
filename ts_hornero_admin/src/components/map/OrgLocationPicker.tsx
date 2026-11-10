import { useEffect, useRef, type CSSProperties } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLng } from '../../lib/geo';

export interface OrgLocationPickerProps {
  /** Map center — usually the marker position, or the user's fallback location. */
  center: LatLng;
  /** Currently selected point, or null when nothing has been picked yet. */
  markerPosition: LatLng | null;
  /** "You are here" marker, independent of the picked org location. */
  userPosition?: LatLng | null;
  /** Increment to force a re-center on `center` (e.g. "use my location" button). */
  recenterSignal?: number;
  /** Fires with the clicked point's coordinates. */
  onPick: (latlng: LatLng) => void;
  height?: number | string;
  style?: CSSProperties;
}

/** Brand pin icon — matches the marker used on the public org map. */
function pinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'hornero-pin',
    html: `
      <svg width="34" height="44" viewBox="0 0 34 44" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,.28))">
        <path d="M17 0C8 0 1 7 1 16c0 11 16 28 16 28s16-17 16-28C33 7 26 0 17 0z" fill="var(--horn, #C85A20)" />
        <circle cx="17" cy="16" r="6.5" fill="#fff" />
      </svg>`,
    iconSize: [34, 44],
    iconAnchor: [17, 44],
    popupAnchor: [0, -42],
  });
}

const userIcon = L.divIcon({
  className: 'hornero-user-pin',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:var(--sky,#4BA3D3);box-shadow:0 0 0 4px #fff,0 3px 8px rgba(0,0,0,.25)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/** Applies the imperative re-center via Leaflet's map instance. */
function MapController({ center, recenterSignal }: { center: LatLng; recenterSignal?: number }) {
  const map = useMap();
  const didInitialCenter = useRef(false);

  useEffect(() => {
    if (didInitialCenter.current) return;
    didInitialCenter.current = true;
  }, []);

  useEffect(() => {
    if (recenterSignal && recenterSignal > 0) {
      map.flyTo([center.lat, center.lng], Math.max(map.getZoom(), 14));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSignal]);

  return null;
}

/** Captures clicks on the map and reports the coordinates (location picker). */
function ClickHandler({ onPick }: { onPick: (latlng: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/**
 * Leaflet-backed location picker. Loaded lazily (see `OrgLocationPickerLazy`)
 * since Leaflet touches `window` and is unnecessary bundle weight until a user
 * reaches the org-creation step.
 */
export default function OrgLocationPicker({
  center,
  markerPosition,
  userPosition,
  recenterSignal,
  onPick,
  height = 280,
  style,
}: OrgLocationPickerProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={14}
      style={{ width: '100%', height, ...style }}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {markerPosition && (
        <Marker position={[markerPosition.lat, markerPosition.lng]} icon={pinIcon()} />
      )}

      {userPosition && <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon} />}

      <ClickHandler onPick={onPick} />
      <MapController center={center} recenterSignal={recenterSignal} />
    </MapContainer>
  );
}
