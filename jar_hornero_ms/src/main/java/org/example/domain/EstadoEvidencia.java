package org.example.domain;

/**
 * The audit state of an {@code organizacion_evidencia} row. {@code estado} is the one mutable
 * field on that entity; every mutation appends its own {@link OrganizacionEvento}.
 */
public enum EstadoEvidencia {
    PENDIENTE,
    APROBADA,
    OBSERVADA,
    REEMPLAZADA,
    /** RN-04: was APROBADA and its validoHasta passed; set by the daily job, never by a person. */
    VENCIDA
}
