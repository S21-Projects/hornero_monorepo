import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { LatLng } from '../../lib/geo';

export interface MapMarkerData {
  id: number | string;
  lat: number;
  lng: number;
  label?: string;
  sub?: string;
  /** Pre-built banner URL (`${PUBLIC_BFF_URL}/images?key=...`). */
  banner?: string;
  /** Highlights the marker (gold) when active/selected. */
  active?: boolean;
  /** Muted pin for organizations nobody has claimed yet. */
  unclaimed?: boolean;
}

export interface MapViewport {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  zoom: number;
}

export interface LeafletMapProps {
  markers?: MapMarkerData[];
  center: LatLng;
  zoom?: number;
  height?: number | string;
  /** "You are here" user position marker. */
  userPosition?: LatLng | null;
  /** Fit viewport to all markers on first render. */
  fitToMarkers?: boolean;
  selectedId?: number | string | null;
  onMarkerSelect?: (id: number | string) => void;
  /** When false, disables drag/zoom (read-only mini-map). */
  interactive?: boolean;
  /** Increment to force re-center on `center` (location button). */
  recenterSignal?: number;
  /** Map click: returns coordinates (location picker). */
  onMapClick?: (latlng: LatLng) => void;
  /** Group nearby markers into clusters (dense lists). */
  clusterMarkers?: boolean;
  /** Fired once when the map is ready and after every pan/zoom. */
  onViewportChange?: (viewport: MapViewport) => void;
  style?: CSSProperties;
}

function pinIcon(active: boolean, unclaimed = false): L.DivIcon {
  const color = active
    ? 'var(--sun, #D4A017)'
    : unclaimed
      ? 'var(--ink-3, #9A8F85)'
      : 'var(--horn, #C85A20)';
  return L.divIcon({
    className: 'hornero-pin',
    html: `
      <svg width="34" height="44" viewBox="0 0 34 44" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,.28))">
        <path d="M17 0C8 0 1 7 1 16c0 11 16 28 16 28s16-17 16-28C33 7 26 0 17 0z" fill="${color}" />
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

function MapController({
  center,
  zoom,
  markers,
  fitToMarkers,
  selectedId,
  recenterSignal,
}: {
  center: LatLng;
  zoom: number;
  markers: MapMarkerData[];
  fitToMarkers?: boolean;
  selectedId?: number | string | null;
  recenterSignal?: number;
}) {
  const map = useMap();
  const didInitialFit = useRef(false);

  useEffect(() => {
    if (didInitialFit.current) return;
    if (fitToMarkers && markers.length > 0) {
      didInitialFit.current = true;
      if (markers.length === 1) {
        map.setView([markers[0].lat, markers[0].lng], zoom);
      } else {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      }
    }
  }, [fitToMarkers, markers, map, zoom]);

  useEffect(() => {
    if (recenterSignal && recenterSignal > 0) {
      map.flyTo([center.lat, center.lng], Math.max(map.getZoom(), 14));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSignal]);

  useEffect(() => {
    if (selectedId == null) return;
    const target = markers.find((m) => m.id === selectedId);
    if (target) {
      map.panTo([target.lat, target.lng], { animate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick: (latlng: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function ViewportReporter({ onViewportChange }: { onViewportChange: (v: MapViewport) => void }) {
  const map = useMap();
  const callback = useRef(onViewportChange);
  callback.current = onViewportChange;

  const report = useMemo(
    () => () => {
      const b = map.getBounds();
      callback.current({
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
        zoom: map.getZoom(),
      });
    },
    [map],
  );

  useMapEvents({ moveend: report, zoomend: report });
  useEffect(report, [report]);
  return null;
}

export default function LeafletMap({
  markers = [],
  center,
  zoom = 13,
  height = '100%',
  userPosition,
  fitToMarkers,
  selectedId,
  onMarkerSelect,
  interactive = true,
  recenterSignal,
  onMapClick,
  clusterMarkers = false,
  onViewportChange,
  style,
}: LeafletMapProps) {
  const icons = useMemo(
    () => ({ active: pinIcon(true), idle: pinIcon(false), unclaimed: pinIcon(false, true) }),
    [],
  );

  const markerNodes = markers.map((m) => {
    const isActive = m.active || m.id === selectedId;
    return (
      <Marker
        key={m.id}
        position={[m.lat, m.lng]}
        icon={isActive ? icons.active : m.unclaimed ? icons.unclaimed : icons.idle}
        zIndexOffset={isActive ? 1000 : 0}
        eventHandlers={{
          click: () => onMarkerSelect?.(m.id),
        }}
      >
        {(m.banner || m.label || m.sub) && (
          <Popup minWidth={200}>
            {m.banner && (
              <img
                src={m.banner}
                alt=""
                style={{
                  width: '100%',
                  height: 90,
                  objectFit: 'cover',
                  borderRadius: 6,
                  marginBottom: 6,
                  display: 'block',
                }}
              />
            )}
            {m.label && <strong>{m.label}</strong>}
            {m.sub && <div style={{ color: 'var(--ink-2)' }}>{m.sub}</div>}
          </Popup>
        )}
      </Marker>
    );
  });

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={{ width: '100%', height, ...style }}
      zoomControl={interactive}
      dragging={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      keyboard={interactive}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {clusterMarkers ? (
        <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
          {markerNodes}
        </MarkerClusterGroup>
      ) : (
        markerNodes
      )}

      {userPosition && <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon} />}

      {onMapClick && <MapClickHandler onMapClick={onMapClick} />}
      {onViewportChange && <ViewportReporter onViewportChange={onViewportChange} />}

      <MapController
        center={center}
        zoom={zoom}
        markers={markers}
        fitToMarkers={fitToMarkers}
        selectedId={selectedId}
        recenterSignal={recenterSignal}
      />
    </MapContainer>
  );
}
