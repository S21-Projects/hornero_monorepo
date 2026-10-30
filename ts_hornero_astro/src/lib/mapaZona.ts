/**
 * Browser-side client for the public viewport endpoint (`GET /organizaciones/mapa/zona`).
 * Uses PUBLIC_BFF_URL (build-time), unlike `publicFetch`, which is server-only.
 */
import { isApiEnvelope } from './publicFetch';
import type { Org, OrgMapa } from './types';

export interface ViewportBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface ZonaResult {
  /** Only SIN_RECLAMAR pins; APROBADA ones come from the SSR list. */
  orgs: Org[];
  /** The server capped the response: the zone holds more pins than were returned. */
  truncated: boolean;
}

const PUBLIC_BFF_URL = import.meta.env.PUBLIC_BFF_URL ?? '';

/** Box edges are snapped outward to this grid (~2 km) so nearby viewports share a cache entry. */
const SNAP_DEG = 0.02;

/** Expands the box outward to the snap grid and clamps it to valid coordinates. */
export function snapBounds(b: ViewportBounds): ViewportBounds {
  const snap = (v: number, up: boolean) =>
    Number(((up ? Math.ceil(v / SNAP_DEG) : Math.floor(v / SNAP_DEG)) * SNAP_DEG).toFixed(2));
  return {
    minLat: Math.max(-90, snap(b.minLat, false)),
    maxLat: Math.min(90, snap(b.maxLat, true)),
    minLng: Math.max(-180, snap(b.minLng, false)),
    maxLng: Math.min(180, snap(b.maxLng, true)),
  };
}

export function boundsKey(b: ViewportBounds): string {
  return `${b.minLat},${b.maxLat},${b.minLng},${b.maxLng}`;
}

function toOrg(p: OrgMapa): Org {
  return {
    id: p.id,
    slug: p.slug,
    nombre: p.nombre,
    tipo: p.tipo,
    estado: p.estado,
    origen: p.origen,
    latitud: p.latitud,
    longitud: p.longitud,
    validada: false,
  };
}

export async function fetchZona(b: ViewportBounds, signal: AbortSignal): Promise<ZonaResult> {
  const qs = new URLSearchParams({
    minLat: String(b.minLat),
    maxLat: String(b.maxLat),
    minLng: String(b.minLng),
    maxLng: String(b.maxLng),
  });
  const res = await fetch(`${PUBLIC_BFF_URL}/organizaciones/mapa/zona?${qs}`, { signal });
  if (!res.ok) throw new Error(`mapa/zona failed: ${res.status}`);
  const body = await res.json();
  const data = (isApiEnvelope(body) ? body.data : body) as { pins: OrgMapa[]; truncated: boolean };
  return {
    orgs: data.pins.filter((p) => p.estado === 'SIN_RECLAMAR').map(toOrg),
    truncated: data.truncated,
  };
}
