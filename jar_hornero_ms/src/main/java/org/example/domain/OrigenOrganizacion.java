package org.example.domain;

/** Where an organizacion row came from. A null column value is read as {@link #PLATAFORMA}. */
public enum OrigenOrganizacion {
    /** Registered through the platform by a referente. */
    PLATAFORMA,
    /** Imported from the ReNaCoM national registry (scripts/mapa/importar-renacom.sql). */
    RENACOM
}
