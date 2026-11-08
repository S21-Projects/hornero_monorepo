package org.example.domain;

/**
 * Per-requisito status as it appears in a legajo export (`specs/organizacion-legajo/spec.md`,
 * "Per-Requisito Status Values"). {@code FALTANTE} means no evidencia row exists at all for that
 * requisito — distinct from {@code PENDIENTE}, where a submission exists but has not been audited.
 */
public enum EstadoRequisitoLegajo {
    APROBADA,
    OBSERVADA,
    PENDIENTE,
    FALTANTE,
    /** RN-04: the approval expired (the evidence row is in state VENCIDA). */
    VENCIDA
}
