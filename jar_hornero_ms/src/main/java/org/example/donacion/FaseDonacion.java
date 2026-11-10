package org.example.donacion;

import org.example.domain.Donacion;
import org.example.domain.EstadoDonacion;
import org.example.domain.ModalidadDonacion;

/**
 * AD-4: no new {@link EstadoDonacion} value is introduced for the pool's extra progress step.
 * Instead, the SPA's progress step is a read-only value derived once here, from
 * {@code modalidad × estado × necesidad presence}, per the table in
 * {@code design.md}'s AD-4. The SPA never re-derives it.
 */
public enum FaseDonacion {
    EN_FONDO,
    ASIGNADA,
    OFRECIDA,
    ACEPTADA,
    EN_CAMINO,
    CONFIRMANDO,
    ENTREGADA,
    RECHAZADA,
    CANCELADA;

    public static FaseDonacion de(Donacion donacion) {
        EstadoDonacion estado = donacion.getEstado();
        if (estado == EstadoDonacion.RECHAZADA) {
            return RECHAZADA;
        }
        if (estado == EstadoDonacion.CANCELADA) {
            return CANCELADA;
        }
        if (estado == EstadoDonacion.OFRECIDA) {
            if (donacion.getModalidadEfectiva() == ModalidadDonacion.FONDO_COMUN) {
                return donacion.getNecesidad() != null ? ASIGNADA : EN_FONDO;
            }
            return OFRECIDA;
        }
        return switch (estado) {
            case ACEPTADA -> ACEPTADA;
            case EN_CAMINO -> EN_CAMINO;
            case PENDIENTE_CONFIRMACION -> CONFIRMANDO;
            case ENTREGADA -> ENTREGADA;
            default -> throw new IllegalStateException("Unhandled estado for fase derivation: " + estado);
        };
    }
}
