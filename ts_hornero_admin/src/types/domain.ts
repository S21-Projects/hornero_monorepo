// Domain types for the DONANTE SPA views (Slice 4).
// Keep in sync with Java MS discriminator values and BFF DTOs.
//
// Note: enums are not used because `erasableSyntaxOnly` is enabled in tsconfig.
// Use `as const` objects + derived union types instead.

export const PrioridadNecesidad = {
  URGENTE: 'URGENTE',
  MEDIA:   'MEDIA',
  NORMAL:  'NORMAL',
} as const;
export type PrioridadNecesidad = typeof PrioridadNecesidad[keyof typeof PrioridadNecesidad];

export const EstadoNecesidad = {
  ABIERTA:     'ABIERTA',
  EN_PROGRESO: 'EN_PROGRESO',
  CUMPLIDA:    'CUMPLIDA',
  VENCIDA:     'VENCIDA',
} as const;
export type EstadoNecesidad = typeof EstadoNecesidad[keyof typeof EstadoNecesidad];

export const EstadoDonacion = {
  OFRECIDA:                'OFRECIDA',
  ACEPTADA:                'ACEPTADA',
  RECHAZADA:               'RECHAZADA',
  EN_CAMINO:               'EN_CAMINO',
  PENDIENTE_CONFIRMACION:  'PENDIENTE_CONFIRMACION',
  ENTREGADA:               'ENTREGADA',
  CANCELADA:               'CANCELADA',
} as const;
export type EstadoDonacion = typeof EstadoDonacion[keyof typeof EstadoDonacion];

/** Mirrors MS `ModalidadDonacion` (`specs/donacion-fondo-comun`). Set at creation, immutable. */
export const ModalidadDonacion = {
  DIRECTA: 'DIRECTA',
  FONDO_COMUN: 'FONDO_COMUN',
} as const;
export type ModalidadDonacion = typeof ModalidadDonacion[keyof typeof ModalidadDonacion];

/**
 * Mirrors MS `Donacion.fase` (`org.example.donacion.FaseDonacion`, AD-4). `EN_FONDO` is a
 * `FONDO_COMUN` donación waiting for a ronda (no `Asignacion` yet); `ASIGNADA` is a `FONDO_COMUN`
 * donación the ronda already matched to a necesidad, still in `OFRECIDA`. `OFRECIDA` is the
 * `DIRECTA` equivalent of the initial step. `ACEPTADA`/`EN_CAMINO`/`CONFIRMANDO`/`ENTREGADA` track
 * the shared delivery pipeline for either modalidad once a necesidad is set; `RECHAZADA`/
 * `CANCELADA` are terminal.
 */
export const FaseDonacion = {
  EN_FONDO: 'EN_FONDO',
  ASIGNADA: 'ASIGNADA',
  OFRECIDA: 'OFRECIDA',
  ACEPTADA: 'ACEPTADA',
  EN_CAMINO: 'EN_CAMINO',
  CONFIRMANDO: 'CONFIRMANDO',
  ENTREGADA: 'ENTREGADA',
  RECHAZADA: 'RECHAZADA',
  CANCELADA: 'CANCELADA',
} as const;
export type FaseDonacion = typeof FaseDonacion[keyof typeof FaseDonacion];

/** Categorías de ítems aceptadas para una donación `FONDO_COMUN` (`CrearDonacionDto`, BFF/MS). */
export const CategoriaDonacion = {
  NO_PERECEDERO: 'NO_PERECEDERO',
  REFRIGERADO: 'REFRIGERADO',
  CONGELADO: 'CONGELADO',
} as const;
export type CategoriaDonacion = typeof CategoriaDonacion[keyof typeof CategoriaDonacion];

/**
 * Mirrors MS `CategoriaAlimento` (`jar_hornero_ms/.../domain/CategoriaAlimento.java`, feature
 * catalogo-articulos). Shared by the articulo catalog and — once work units F/G/H land — the
 * donación línea and necesidad articulo pickers, so this stays the one canonical type rather than
 * each form declaring its own copy. Same values as `CategoriaDonacion`, kept as a distinct type
 * since that one predates the catalog and is scoped to the donación create DTO.
 */
export const CategoriaAlimento = {
  NO_PERECEDERO: 'NO_PERECEDERO',
  REFRIGERADO: 'REFRIGERADO',
  CONGELADO: 'CONGELADO',
} as const;
export type CategoriaAlimento = typeof CategoriaAlimento[keyof typeof CategoriaAlimento];

/** Mirrors MS `UnidadArticulo` (feature catalogo-articulos, work unit A). */
export const UnidadArticulo = {
  KG: 'KG',
  PAQUETE: 'PAQUETE',
  LITRO: 'LITRO',
  UNIDAD: 'UNIDAD',
} as const;
export type UnidadArticulo = typeof UnidadArticulo[keyof typeof UnidadArticulo];

/** Mirrors MS `ArticuloResponse` (`GET/POST/PUT /articulos`, BFF `articulos` proxy, work unit E). */
export interface Articulo {
  id: number;
  nombre: string;
  categoria: CategoriaAlimento;
  unidad: UnidadArticulo;
  activo: boolean;
}

/** Body for `POST /articulos` and `PUT /articulos/:id` (full edit — MS requires all 3 fields). */
export interface ArticuloInput {
  nombre: string;
  categoria: CategoriaAlimento;
  unidad: UnidadArticulo;
}

/** One line of a `CrearDonacionDto` body (work units E/G, decision 4): articulo id + cantidad. */
export interface DonacionLineaInput {
  articuloId: number;
  cantidad: number;
}

/** Mirrors MS `DonacionResponse`/`DonacionActivaResponse`'s `lineas` component (work unit E). */
export interface DonacionLinea {
  articuloId: number;
  nombre: string;
  unidad: UnidadArticulo;
  cantidad: number;
}

/** Mirrors MS `NecesidadResponse`'s `articulos` component (work unit E, decision 6). */
export interface NecesidadArticulo {
  id: number;
  nombre: string;
  unidad: UnidadArticulo;
  categoria: CategoriaAlimento;
}

// --- Info pública (aceptaDonaciones, sitioWebUrl, donacionDirectaUrl) ---
// Live values are always present on any authenticated response. Pending
// values are populated only while a referente-submitted change awaits
// admin approval (infoPublicaPendienteEn non-null); the public Astro site
// never sees the pending trio (server-side gating at the MS, D6).
export interface InfoPublica {
  aceptaDonaciones: boolean;
  sitioWebUrl?: string | null;
  donacionDirectaUrl?: string | null;
}

export interface InfoPublicaPendiente {
  aceptaDonacionesPendiente?: boolean | null;
  sitioWebUrlPendiente?: string | null;
  donacionDirectaUrlPendiente?: string | null;
  infoPublicaPendienteEn?: string | null;
}

export interface Organizacion extends InfoPublica, InfoPublicaPendiente {
  id: number;
  slug: string;
  nombre: string;
  validada: boolean;
  estado: EstadoOrganizacion;
  origen?: OrigenOrganizacion;
  asistentesDeclarados?: number | null;
  referenteId?: number | null;
  profileImageKey?: string | null;
  bannerKey?: string | null;
}

export interface CrearOrganizacionInput {
  nombre: string;
  tipo: TipoOrganizacion;
  direccion?: string;
  descripcion?: string;
  latitud: number;
  longitud: number;
}

export interface Necesidad {
  id: number;
  descripcion: string;
  prioridad: PrioridadNecesidad;
  estado: EstadoNecesidad;
  fechaPublicacion?: string;
  fechaVencimiento?: string;
  organizacionId: number;
  /** Requested articulos (feature catalogo-articulos, decision 6); `categoria` is derived from
   * these. Absent on pre-catalog responses. */
  articulos?: NecesidadArticulo[];
}

export interface Donacion {
  id: number;
  fechaOferta?: string;
  fechaEntrega?: string;
  estado: EstadoDonacion;
  observaciones?: string;
  /** Null when the viewer may not see the donor (D5: only admin, the donor and the receiving referente). */
  donanteName?: string | null;
  donanteId?: number | null;
  /** Null for a `FONDO_COMUN` donación — it has no necesidad until the solver assigns it. */
  necesidadId: number | null;
  organizacionId?: number | null;
  /** MS `DonacionResponse.organizacionNombre` — the counterpart's name for a donante viewer
   * (slice 3c's confirmation screen header). */
  organizacionNombre?: string;
  confirmadaDonanteEn?: string;
  confirmadaReferenteEn?: string;
  /** Set at creation, immutable (`specs/donacion-fondo-comun`). Absent on pre-5e responses. */
  modalidad?: ModalidadDonacion;
  fase?: FaseDonacion;
  /** Lines of articulo+cantidad offered (feature catalogo-articulos, decision 4). Absent on
   * pre-catalog responses. */
  lineas?: DonacionLinea[];
}

/**
 * Mirrors MS `AsignacionResponse` (`GET /api/donaciones/{id}/asignaciones`, spec
 * `ronda-asignacion`): one history row per ronda match for this donación, append-only — a
 * devolución/reassignment adds a new row rather than overwriting the prior one.
 */
export interface AsignacionHistorial {
  id: number;
  rondaId: number;
  /** ISO `YYYY-MM-DD` — the ronda's execution date. */
  rondaFecha: string;
  necesidadId: number;
  organizacionId: number;
  organizacionNombre: string;
  estado: 'PROPUESTA' | 'ACEPTADA' | 'RECHAZADA' | 'CANCELADA';
  score: number;
  costoOportunidad: number;
  distanciaKm: number;
  terminoDeficit: number;
  terminoUrgencia: number;
  terminoProximidad: number;
  terminoEspera: number;
  /** Null until slice 6b's worker response carries the 5th criterion. */
  terminoCumplimiento: number | null;
  deficitFuente: string;
  codigoRadio: string;
  creadaEn: string;
  resueltaEn: string | null;
  /**
   * Weights the ronda actually applied (task 5f.15), snapshotted from `asignacion.getRonda()`.
   * Null only for rows from before AD-9's snapshot existed — `DesgloseScore` falls back to the
   * pre-6a hardcoded defaults in that case.
   */
  pesoDeficit?: number | null;
  pesoUrgencia?: number | null;
  pesoProximidad?: number | null;
  pesoEspera?: number | null;
  pesoCumplimiento?: number | null;
}

/**
 * Mirrors MS `RondaResponse` (AD-9, spec `ronda-asignacion`): one triggered ronda, including a
 * `FALLIDA` one (worker error/timeout — `error` carries the reason, every counter stays 0).
 * `pesoCumplimiento` is null until slice 6b/6a populate the fifth criterion end to end.
 */
export interface RondaResponse {
  id: number;
  ejecutadaEn: string;
  finalizadaEn: string | null;
  /** `null` for a scheduled (AUTOMATICA) ronda, which has no executing user (N7). */
  ejecutadaPor: number | null;
  /** Resolved server-side from `usuarios` (T6); `null` when the executor account no longer exists. */
  ejecutadaPorNombre: string | null;
  origen: 'MANUAL' | 'AUTOMATICA';
  estado: 'COMPLETADA' | 'FALLIDA';
  error: string | null;
  versionContrato: number;
  donacionesConsideradas: number;
  candidatosConsiderados: number;
  asignadas: number;
  sinAsignar: number;
  descartadas: number;
  scoreTotal: number | null;
  pesoDeficit: number | null;
  pesoUrgencia: number | null;
  pesoProximidad: number | null;
  pesoEspera: number | null;
  pesoCumplimiento: number | null;
}

/** Mirrors MS `RondaFondoResponse` (`GET /api/rondas/fondo`): pool size before triggering a ronda. */
export interface RondaFondoResponse {
  pendientes: number;
  masAntiguaDesde: string | null;
}

/**
 * `necesidadId` required, `DIRECTA` is implicit when `modalidad` is omitted (MS coalescing).
 * `lineas` is required for both modalidades (feature catalogo-articulos, decision 4) — `categoria`
 * is no longer client-supplied, it's always derived from `lineas` by the MS.
 */
export interface CrearDonacionDirectaInput {
  necesidadId: number;
  lineas: DonacionLineaInput[];
  observaciones?: string;
}

/** `FONDO_COMUN`: no `necesidadId` — `lineas` + pickup coordinates are required instead. */
export interface CrearDonacionFondoComunInput {
  modalidad: typeof ModalidadDonacion.FONDO_COMUN;
  lineas: DonacionLineaInput[];
  latitud: number;
  longitud: number;
  observaciones?: string;
}

export type CrearDonacionInput = CrearDonacionDirectaInput | CrearDonacionFondoComunInput;

/** `articuloIds` required, ≥1 (feature catalogo-articulos, decision 6) — `categoria` is derived. */
export interface CrearNecesidadInput {
  descripcion: string;
  prioridad: PrioridadNecesidad;
  fechaVencimiento?: string;
  articuloIds: number[];
}

/** Relaunch of an expired necesidad: the new expiry date must be after today. */
export interface RelanzarNecesidadInput {
  fechaVencimiento: string;
}

export interface ActualizarNecesidadInput {
  descripcion?: string;
  prioridad?: PrioridadNecesidad;
  estado?: EstadoNecesidad;
  fechaVencimiento?: string;
  /** Omitted/undefined leaves the current selection unchanged; when present it must be non-empty
   * (a necesidad can never be left with zero articulos). */
  articuloIds?: number[];
}

// ---------------------------------------------------------------------------
// Admin types (Slice 6)
// ---------------------------------------------------------------------------

import type { UserRole } from '../store/auth.store';

export const EstadoOrganizacion = {
  PENDIENTE: 'PENDIENTE',
  APROBADA:  'APROBADA',
  RECHAZADA: 'RECHAZADA',
  SIN_RECLAMAR: 'SIN_RECLAMAR',
  INACTIVA:  'INACTIVA',
} as const;
export type EstadoOrganizacion = typeof EstadoOrganizacion[keyof typeof EstadoOrganizacion];

/** Mirrors MS `OrigenOrganizacion`: where an organizacion row came from. */
export const OrigenOrganizacion = {
  PLATAFORMA: 'PLATAFORMA',
  RENACOM:    'RENACOM',
} as const;
export type OrigenOrganizacion = typeof OrigenOrganizacion[keyof typeof OrigenOrganizacion];

/** Item of `GET /organizaciones/mapa` (MS `OrganizacionMapaResponse`): lightweight map pin. */
export interface OrganizacionMapa {
  id: number;
  slug: string;
  nombre: string;
  tipo: TipoOrganizacion;
  estado: EstadoOrganizacion;
  origen: OrigenOrganizacion;
  latitud: number;
  longitud: number;
  /** Open, uncovered necesidades (ABIERTA or EN_PROGRESO, not expired). */
  necesidadesAbiertas: number;
}

export const TipoOrganizacion = {
  COMEDOR:   'COMEDOR',
  COPITA:    'COPITA',
  ROPERO:    'ROPERO',
  MERENDERO: 'MERENDERO',
  OTRO:      'OTRO',
} as const;
export type TipoOrganizacion = typeof TipoOrganizacion[keyof typeof TipoOrganizacion];

export interface OrganizacionAdmin extends InfoPublica, InfoPublicaPendiente {
  id: number;
  nombre: string;
  slug: string;
  tipo: TipoOrganizacion;
  descripcion: string;
  direccion: string;
  latitud?: number;
  longitud?: number;
  estado: EstadoOrganizacion;
  referenteId?: number | null;
  referenteNombre?: string;
  referenteEmail?: string;
  validadoPorNombre?: string;
  profileImageKey?: string;
  bannerKey?: string;
}

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  tipo: UserRole;
  activo: boolean;
}

// ---------------------------------------------------------------------------
// Acreditación progresiva — mirrors jar_hornero_ms's `acreditacion/dto/*.java`
// and ts_hornero_bff's `acreditacion/dto/*.ts`. FOTO/DOCUMENTO evidence files
// are rendered through the authenticated `evidencia-files` route, bound to an
// existing row (AD-12, `specs/organizacion-evidencia/spec.md`).
// ---------------------------------------------------------------------------

export const NivelAcreditacion = {
  N0: 'N0',
  N1: 'N1',
  N2: 'N2',
  N3: 'N3',
} as const;
export type NivelAcreditacion = typeof NivelAcreditacion[keyof typeof NivelAcreditacion];

export const RequisitoAcreditacion = {
  SERVICIO_REGULAR_GRATUITO: 'SERVICIO_REGULAR_GRATUITO',
  NO_DISCRIMINACION: 'NO_DISCRIMINACION',
  SEDE_INSCRIPTA_INDIVIDUALMENTE: 'SEDE_INSCRIPTA_INDIVIDUALMENTE',
  CONDICIONES_SANITARIAS_ADECUADAS: 'CONDICIONES_SANITARIAS_ADECUADAS',
  SIN_KIOSCO_MISMO_DOMICILIO: 'SIN_KIOSCO_MISMO_DOMICILIO',
  RADIO_50KM_BANCO_ALIMENTOS: 'RADIO_50KM_BANCO_ALIMENTOS',
  PERSONERIA_JURIDICA_O_AVAL: 'PERSONERIA_JURIDICA_O_AVAL',
  ACEPTA_AUDITORIAS_SIN_AVISO: 'ACEPTA_AUDITORIAS_SIN_AVISO',
} as const;
export type RequisitoAcreditacion = typeof RequisitoAcreditacion[keyof typeof RequisitoAcreditacion];

export const TipoEvidencia = {
  DECLARACION: 'DECLARACION',
  FOTO: 'FOTO',
  DOCUMENTO: 'DOCUMENTO',
} as const;
export type TipoEvidencia = typeof TipoEvidencia[keyof typeof TipoEvidencia];

export const EstadoEvidencia = {
  PENDIENTE: 'PENDIENTE',
  APROBADA: 'APROBADA',
  OBSERVADA: 'OBSERVADA',
  REEMPLAZADA: 'REEMPLAZADA',
} as const;
export type EstadoEvidencia = typeof EstadoEvidencia[keyof typeof EstadoEvidencia];

export const EstadoRequisitoLegajo = {
  APROBADA: 'APROBADA',
  OBSERVADA: 'OBSERVADA',
  PENDIENTE: 'PENDIENTE',
  FALTANTE: 'FALTANTE',
} as const;
export type EstadoRequisitoLegajo = typeof EstadoRequisitoLegajo[keyof typeof EstadoRequisitoLegajo];

/** Mirrors `AcreditacionResponse` (MS) / `GET /{id}/acreditacion` (BFF). */
export interface AcreditacionResponse {
  organizacionId: number;
  nivel: NivelAcreditacion;
  nivelDesde: string;
}

/** Mirrors `EvidenciaResponse` (MS) / evidence-mutation responses (BFF). */
export interface EvidenciaResponse {
  id: number;
  organizacionId: number;
  requisito: RequisitoAcreditacion;
  tipoEvidencia: TipoEvidencia;
  /** R2 key under `org-evidencia/{orgId}/` — additive field (AD-12). Null for DECLARACION rows. */
  objectKey?: string | null;
  declaracion?: string | null;
  validoDesde?: string | null;
  validoHasta?: string | null;
  estado: EstadoEvidencia;
  expirada: boolean;
  cargadoPor?: number | null;
  cargadoEn?: string | null;
  revisadoPor?: number | null;
  revisadoEn?: string | null;
  observacion?: string | null;
}

/** Which partition of the cross-org audit queue is requested (AD-8). Mirrors MS `TabCola`. */
export const TabCola = {
  PENDIENTES: 'PENDIENTES',
  VENCIDAS: 'VENCIDAS',
} as const;
export type TabCola = typeof TabCola[keyof typeof TabCola];

/**
 * Mirrors `EvidenciaEnColaResponse` (MS) — one row of the cross-org audit queue (AD-8,
 * `specs/auditoria-cola-global/spec.md`). Same fields as `EvidenciaResponse` plus the
 * organizacion's display name/level and the requisito's `nivelExigido`, since a single-org
 * queue (`EvidenciaResponse`) has no need to show any of the three.
 */
export interface EvidenciaEnColaResponse {
  id: number;
  organizacionId: number;
  organizacionNombre: string;
  organizacionNivel: NivelAcreditacion;
  requisito: RequisitoAcreditacion;
  nivelExigido: NivelAcreditacion;
  tipoEvidencia: TipoEvidencia;
  objectKey?: string | null;
  declaracion?: string | null;
  validoDesde?: string | null;
  validoHasta?: string | null;
  estado: EstadoEvidencia;
  expirada: boolean;
  cargadoPor?: number | null;
  cargadoEn?: string | null;
  revisadoPor?: number | null;
  revisadoEn?: string | null;
  observacion?: string | null;
}

/** Mirrors `EventoResponse` (MS). `actorUsuarioId` is null on a referente-facing legajo (D-01). */
export interface EventoResponse {
  tipo: string;
  ocurridoEn: string;
  actorTipo: string;
  actorUsuarioId?: number | null;
  nivelAntes?: NivelAcreditacion | null;
  nivelDespues?: NivelAcreditacion | null;
  requisito?: RequisitoAcreditacion | null;
  motivo?: string | null;
}

/** Mirrors `RequisitoEnLegajo` (MS). */
export interface RequisitoEnLegajo {
  requisito: RequisitoAcreditacion;
  nivelExigido: NivelAcreditacion;
  estado: EstadoRequisitoLegajo;
  tipoEvidencia?: TipoEvidencia | null;
  declaracion?: string | null;
  validoDesde?: string | null;
  validoHasta?: string | null;
  expirada: boolean;
  auditorNombre?: string | null;
  auditadoEn?: string | null;
  /**
   * R2 key under `org-evidencia/{orgId}/` for FOTO/DOCUMENTO evidence — additive field
   * (tesis-core-features task 2.24, AD-12 follow-up). `null`/absent for DECLARACION evidence and
   * for FALTANTE requisitos.
   */
  objectKey?: string | null;
}

/** Mirrors `LegajoResponse` (MS) — server-assembled, proxied unmodified by the BFF (AD-11). */
export interface LegajoResponse {
  organizacionId: number;
  nombre: string;
  slug: string;
  direccion: string;
  nivel: NivelAcreditacion;
  nivelDesde: string;
  requisitos: RequisitoEnLegajo[];
  eventos: EventoResponse[];
  disclosure: string;
}

/** Mirrors `DonacionActivaResponse` (MS) — the row shape for `/donaciones/activas` (Slice 6). */
export interface DonacionActiva {
  id: number;
  fechaOferta?: string;
  fechaEntrega?: string;
  estado: EstadoDonacion;
  observaciones?: string;
  donanteId?: number;
  donanteNombre?: string;
  necesidadId: number;
  necesidadDescripcion?: string;
  organizacionId?: number;
  organizacionNombre?: string;
  confirmadaDonanteEn?: string;
  confirmadaReferenteEn?: string;
  overrideMotivo?: string;
  overrideAdminId?: number;
  overrideEn?: string;
  modalidad?: ModalidadDonacion;
  fase?: FaseDonacion;
  lineas?: DonacionLinea[];
  /** N12/D4: computed server-side from `estadoDesde` and the configured windows. */
  estancada?: boolean;
  diasEnEstado?: number;
}

/** Mirrors `ActividadResponse` (MS) — one row of the append-only activity log (N10). */
export interface Actividad {
  id: number;
  ocurridoEn: string;
  actorUsuarioId: number | null;
  actorTipo: string;
  accion: string;
  resultado: string;
  entidadTipo: string | null;
  entidadId: number | null;
  detalle: string | null;
  antes: string | null;
  despues: string | null;
  motivo: string | null;
  ip: string | null;
  emailIntento: string | null;
  /** Resolved by the MS from actorUsuarioId; null for SISTEMA/ANONIMO rows or deleted users. */
  actorNombre: string | null;
  actorEmail: string | null;
}

// ---------------------------------------------------------------------------
// Claim flow for unclaimed (ReNaCoM) organizaciones — mirrors jar_hornero_ms's
// `reclamo/dto/*.java` and ts_hornero_bff's `reclamos/dto/*.ts`.
// ---------------------------------------------------------------------------

export const RolReclamo = {
  RESPONSABLE: 'RESPONSABLE',
  VOLUNTARIO: 'VOLUNTARIO',
  INTEGRANTE: 'INTEGRANTE',
} as const;
export type RolReclamo = typeof RolReclamo[keyof typeof RolReclamo];

export const EstadoReclamo = {
  PENDIENTE: 'PENDIENTE',
  APROBADO: 'APROBADO',
  RECHAZADO: 'RECHAZADO',
} as const;
export type EstadoReclamo = typeof EstadoReclamo[keyof typeof EstadoReclamo];

export interface Reclamo {
  id: number;
  organizacionId: number;
  organizacionNombre: string;
  organizacionSlug: string;
  organizacionDireccion?: string | null;
  solicitanteId: number;
  solicitanteNombre: string;
  solicitanteEmail: string;
  rol: RolReclamo;
  telefono: string;
  mensaje?: string | null;
  /** Keys under `reclamo-evidencia/{orgId}/{solicitanteId}/`; read through `reclamo-files`. */
  evidenciaKeys: string[];
  estado: EstadoReclamo;
  motivoRechazo?: string | null;
  resueltoPorNombre?: string | null;
  creadoEn: string;
  resueltoEn?: string | null;
  /** Admin detail only: the claimant's organizaciones a cargo and the cap (the "n/3"). */
  organizacionesACargo?: number | null;
  capOrganizaciones?: number | null;
}

export interface CrearReclamoInput {
  organizacionId: number;
  rol: RolReclamo;
  telefono: string;
  mensaje?: string;
  evidenciaKeys: string[];
}

// ---------------------------------------------------------------------------
// Report flow for unclaimed (ReNaCoM) organizaciones — mirrors jar_hornero_ms's
// `reporte/dto/*.java` and ts_hornero_bff's `reportes/dto/*.ts`.
// ---------------------------------------------------------------------------

export const MotivoReporte = {
  INACTIVO: 'INACTIVO',
  DATOS_INCORRECTOS: 'DATOS_INCORRECTOS',
  DUPLICADO: 'DUPLICADO',
  OTRO: 'OTRO',
} as const;
export type MotivoReporte = typeof MotivoReporte[keyof typeof MotivoReporte];

export const EstadoReporte = {
  PENDIENTE: 'PENDIENTE',
  CONFIRMADO: 'CONFIRMADO',
  DESCARTADO: 'DESCARTADO',
} as const;
export type EstadoReporte = typeof EstadoReporte[keyof typeof EstadoReporte];

export interface Reporte {
  id: number;
  organizacionId: number;
  organizacionNombre: string;
  organizacionSlug: string;
  organizacionDireccion?: string | null;
  reportanteId: number;
  reportanteNombre: string;
  reportanteEmail: string;
  motivo: MotivoReporte;
  /** Set iff `motivo` is DUPLICADO: the Hornero organizacion it duplicates. */
  organizacionDuplicadaId?: number | null;
  organizacionDuplicadaNombre?: string | null;
  organizacionDuplicadaSlug?: string | null;
  detalle?: string | null;
  estado: EstadoReporte;
  notaResolucion?: string | null;
  resueltoPorNombre?: string | null;
  creadoEn: string;
  resueltoEn?: string | null;
}

export interface CrearReporteInput {
  organizacionId: number;
  motivo: MotivoReporte;
  organizacionDuplicadaId?: number;
  detalle?: string;
}

/** A Hornero organizacion within 500 m of the reported one (the duplicate picker). */
export interface OrganizacionCercana {
  id: number;
  slug: string;
  nombre: string;
  direccion?: string | null;
  distanciaMetros: number;
}
