package org.example.domain;

/** Why a visitor reports an unclaimed (ReNaCoM) organizacion. */
public enum MotivoReporte {
    /** It closed or stopped serving meals. */
    INACTIVO,
    /** Address, name or type are wrong. */
    DATOS_INCORRECTOS,
    /** It is the same organization as another one already on the platform (see organizacionDuplicada). */
    DUPLICADO,
    OTRO
}
