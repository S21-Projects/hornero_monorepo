package org.example.domain;

import java.util.EnumSet;
import java.util.Set;

public enum EstadoDonacion {
    OFRECIDA,
    ACEPTADA,
    RECHAZADA,
    EN_CAMINO,
    PENDIENTE_CONFIRMACION,
    ENTREGADA,
    CANCELADA;

    public boolean isTerminal() {
        return this == ENTREGADA || this == RECHAZADA || this == CANCELADA;
    }

    public static final Set<EstadoDonacion> NO_TERMINALES =
            EnumSet.of(OFRECIDA, ACEPTADA, EN_CAMINO, PENDIENTE_CONFIRMACION);
}
