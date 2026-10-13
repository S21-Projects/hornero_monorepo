import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { OrgMapa } from '../../lib/types';
import { colorFor, NULL_STROKE, type DepartamentoProps } from '../../lib/vulnerabilidad';

export type DepartamentoCollection = FeatureCollection<Geometry, DepartamentoProps>;

export interface Layers {
  vulnerabilidad: boolean;
  densidad: boolean;
  plataforma: boolean;
  sinReclamar: boolean;
}

interface Props {
  departamentos: DepartamentoCollection | null;
  pins: OrgMapa[];
  layers: Layers;
  selectedCodigo: string | null;
  /** Changes when the user picks a departamento from the select: fit the map to it. */
  focus: { codigo: string; n: number } | null;
  onSelect: (props: DepartamentoProps | null) => void;
}

const ARGENTINA_BOUNDS: L.LatLngBoundsExpression = [
  [-55, -73.5],
  [-21.5, -53.5],
];

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function pinPopup(o: OrgMapa): HTMLElement {
  const el = document.createElement('div');
  const origen = o.origen === 'PLATAFORMA' ? 'Organización en Hornero' : 'Comedor del registro, sin reclamar';
  const needs =
    o.necesidadesAbiertas > 0
      ? `<div>${o.necesidadesAbiertas} ${o.necesidadesAbiertas === 1 ? 'necesidad sin cubrir' : 'necesidades sin cubrir'}</div>`
      : '';
  el.innerHTML =
    `<strong>${escapeHtml(o.nombre)}</strong><div>${origen}</div>${needs}` +
    `<a href="/org/${encodeURIComponent(o.slug)}" style="display:inline-block;margin-top:6px;font-weight:800;color:#1C6E96">Ver organización</a>`;
  return el;
}

function MapaLayers({ departamentos, pins, layers, selectedCodigo, focus, onSelect }: Props) {
  const map = useMap();
  // One canvas renderer for everything: polygons are drawn first, pins last, so a click on a pin
  // wins the hit test and a click on empty canvas falls through to the polygon underneath.
  const rendererRef = useRef<L.Canvas>(L.canvas({ padding: 0.5, tolerance: 6 }));
  const choroRef = useRef<L.GeoJSON | null>(null);
  const densidadRef = useRef<L.FeatureGroup>(L.featureGroup());
  const plataformaRef = useRef<L.FeatureGroup>(L.featureGroup());
  const sinReclamarRef = useRef<L.FeatureGroup>(L.featureGroup());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Initial fit.
  useEffect(() => {
    map.fitBounds(ARGENTINA_BOUNDS);
  }, [map]);

  // Choropleth, built once the static GeoJSON is in.
  useEffect(() => {
    if (!departamentos) return;
    const layer = L.geoJSON(departamentos, {
      renderer: rendererRef.current,
      style: (f) => {
        const v = f?.properties?.vulnerabilidad as number | null | undefined;
        return v == null
          ? { fillColor: colorFor(null), fillOpacity: 0.35, color: NULL_STROKE, weight: 0.8, dashArray: '3 3', opacity: 0.8 }
          : { fillColor: colorFor(v), fillOpacity: 0.78, color: '#FFFCF7', weight: 0.6, opacity: 0.9 };
      },
      onEachFeature: (f, l) => {
        l.on('click', (e) => {
          L.DomEvent.stop(e);
          onSelectRef.current(f.properties as DepartamentoProps);
        });
      },
      // `renderer` is forwarded by Leaflet to each child path but missing from the typings.
    } as L.GeoJSONOptions);
    choroRef.current = layer;
    if (layers.vulnerabilidad) layer.addTo(map);
    syncLayers();
    return () => {
      layer.remove();
      choroRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departamentos, map]);

  // Pins + density, rebuilt when the data arrives.
  useEffect(() => {
    const dens = densidadRef.current.clearLayers();
    const plat = plataformaRef.current.clearLayers();
    const sin = sinReclamarRef.current.clearLayers();
    const r = rendererRef.current;
    for (const o of pins) {
      const ll: L.LatLngExpression = [o.latitud, o.longitud];
      // Density: large, very transparent, non-interactive discs; overlapping ones accumulate.
      dens.addLayer(
        L.circleMarker(ll, { renderer: r, radius: 16, stroke: false, fillColor: '#C85A20', fillOpacity: 0.07, interactive: false }),
      );
      if (o.origen === 'PLATAFORMA') {
        plat.addLayer(
          L.circleMarker(ll, { renderer: r, radius: 7, color: '#FFFFFF', weight: 2, fillColor: '#C85A20', fillOpacity: 1 }).bindPopup(() => pinPopup(o)),
        );
      } else {
        sin.addLayer(
          L.circleMarker(ll, { renderer: r, radius: 3.5, color: '#2C2C2A', weight: 1, fillColor: '#FFFFFF', fillOpacity: 1 }).bindPopup(() => pinPopup(o)),
        );
      }
    }
    syncLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, map]);

  function toggle(layer: L.Layer, on: boolean) {
    if (on && !map.hasLayer(layer)) layer.addTo(map);
    if (!on && map.hasLayer(layer)) layer.remove();
  }

  function syncLayers() {
    if (choroRef.current) {
      toggle(choroRef.current, layers.vulnerabilidad);
      if (layers.vulnerabilidad) choroRef.current.eachLayer((l) => (l as L.Path).bringToBack());
    }
    toggle(densidadRef.current, layers.densidad);
    toggle(sinReclamarRef.current, layers.sinReclamar);
    toggle(plataformaRef.current, layers.plataforma);
    // Draw order on the shared canvas: density, then unclaimed, then platform pins on top.
    for (const g of [densidadRef.current, sinReclamarRef.current, plataformaRef.current]) {
      if (map.hasLayer(g)) g.eachLayer((l) => (l as L.Path).bringToFront());
    }
  }

  useEffect(syncLayers, [layers, map]);

  // Highlight the selected departamento.
  useEffect(() => {
    choroRef.current?.eachLayer((l) => {
      const f = (l as L.GeoJSON & { feature?: Feature<Geometry, DepartamentoProps> }).feature;
      const sel = f?.properties.codigo === selectedCodigo;
      (l as L.Path).setStyle({ color: sel ? '#2C2C2A' : f?.properties.vulnerabilidad == null ? NULL_STROKE : '#FFFCF7', weight: sel ? 2.5 : 0.6 });
      if (sel) (l as L.Path).bringToFront();
    });
  }, [selectedCodigo, departamentos, layers.vulnerabilidad]);

  // Fit to a departamento picked from the select.
  useEffect(() => {
    if (!focus || !choroRef.current) return;
    choroRef.current.eachLayer((l) => {
      const f = (l as L.GeoJSON & { feature?: Feature<Geometry, DepartamentoProps> }).feature;
      if (f?.properties.codigo === focus.codigo) map.fitBounds((l as L.Polygon).getBounds(), { maxZoom: 9 });
    });
  }, [focus, map]);

  return null;
}

export default function MapaVulnerabilidadMap(props: Props) {
  return (
    <MapContainer
      bounds={ARGENTINA_BOUNDS}
      style={{ width: '100%', height: '100%' }}
      minZoom={3}
      preferCanvas
      attributionControl
    >
      {/* Reduced visual weight so the choropleth reads first. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        opacity={0.45}
        className="mapa-tiles-muted"
      />
      <MapaLayers {...props} />
    </MapContainer>
  );
}
