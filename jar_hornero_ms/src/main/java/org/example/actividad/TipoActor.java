package org.example.actividad;

/** Who performed an action. The first three match the JWT {@code tipo} claim. */
public enum TipoActor {
    ADMINISTRADOR,
    REFERENTE,
    DONANTE,
    /** Scheduled jobs and startup tasks. */
    SISTEMA,
    /** No authenticated principal (failed login, registration, OTP, refresh). */
    ANONIMO;

    /** Maps a JWT {@code tipo} / discriminator value; anything unknown reads as ANONIMO. */
    public static TipoActor desdeTipo(String tipo) {
        if (tipo == null) {
            return ANONIMO;
        }
        try {
            return valueOf(tipo.toUpperCase());
        } catch (IllegalArgumentException e) {
            return ANONIMO;
        }
    }
}
