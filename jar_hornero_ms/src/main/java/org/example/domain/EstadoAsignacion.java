package org.example.domain;

/**
 * Lifecycle of an {@link Asignacion} row (AD-3, AD-9). {@code PROPUESTA} is set by the ronda that
 * created it; the donación's later accept/devolución/cancel/override resolves the vigente
 * asignación to {@code ACEPTADA}/{@code RECHAZADA}/{@code CANCELADA} (wired in slice 5c-ii).
 */
public enum EstadoAsignacion {
    PROPUESTA,
    ACEPTADA,
    RECHAZADA,
    CANCELADA
}
