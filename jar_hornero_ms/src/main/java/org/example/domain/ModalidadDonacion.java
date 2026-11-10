package org.example.domain;

/**
 * A donación's channel (`specs/donacion-fondo-comun/spec.md` "Modalidad Vocabulary and
 * Immutability"). Set at creation time and never mutated afterward — {@link Donacion#getModalidad()}
 * is {@code updatable = false} at the JPA column level, and no service code path ever calls
 * {@code setModalidad} after {@code crear}.
 */
public enum ModalidadDonacion {
    DIRECTA,
    FONDO_COMUN
}
