/**
 * The cross-org audit queue's query params (AD-8, `specs/auditoria-cola-global/spec.md`),
 * forwarded to the MS `GET /api/auditoria/evidencias` raw — no BFF-side validation, mirroring
 * `NecesidadesService.getNecesidades`'s passthrough of `page`/`size`/`sort`. The MS is the single
 * authority for valid `tab`/`nivel`/`requisito`/`tipoEvidencia` values.
 */
export interface ColaAuditoriaFiltro {
  tab?: string;
  nivel?: string;
  requisito?: string;
  tipoEvidencia?: string;
  page?: string;
  size?: string;
  sort?: string;
}
