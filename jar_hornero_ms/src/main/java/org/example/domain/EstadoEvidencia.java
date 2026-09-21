package org.example.domain;

/**
 * The audit state of an {@code organizacion_evidencia} row. {@code estado} is the one mutable
 * field on that entity; every mutation appends its own {@link OrganizacionEvento}.
 */
public enum EstadoEvidencia {
    PENDIENTE,
    APROBADA,
    OBSERVADA,
    REEMPLAZADA
}
