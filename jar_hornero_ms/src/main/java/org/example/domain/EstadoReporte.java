package org.example.domain;

/** Lifecycle of a {@link ReporteOrganizacion}: PENDIENTE is the only state an admin can resolve. */
public enum EstadoReporte {
    PENDIENTE,
    /** An admin accepted the report (the organizacion was marked INACTIVA). */
    CONFIRMADO,
    DESCARTADO
}
