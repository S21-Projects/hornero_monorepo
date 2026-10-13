package org.example.domain;

/** Lifecycle of a {@link ReclamoOrganizacion}: PENDIENTE is the only state an admin can resolve. */
public enum EstadoReclamo {
    PENDIENTE,
    APROBADO,
    RECHAZADO
}
