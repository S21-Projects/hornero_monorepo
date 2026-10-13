package org.example.domain;

public enum EstadoOrganizacion {
    PENDIENTE,
    APROBADA,
    RECHAZADA,
    /** Imported from an external registry (ReNaCoM) and not yet claimed by a referente. */
    SIN_RECLAMAR,
    /** Reported as closed/inactive; kept for history, never shown as active. */
    INACTIVA;

    /** True for the states that only the claim/report flows may leave (never the legacy validar/rechazar). */
    public boolean esDeRegistroExterno() {
        return this == SIN_RECLAMAR || this == INACTIVA;
    }
}
