package org.example.donacion;

import org.example.domain.Donacion;
import org.example.domain.EstadoDonacion;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

/**
 * N12/D4: "estancada" is computed, never stored. {@code ACEPTADA}/{@code EN_CAMINO} are stale
 * strictly after the en-curso window, {@code PENDIENTE_CONFIRMACION} strictly after the
 * confirmation window; every other estado is never flagged (offers are auto-resolved by the job).
 */
public final class EstancamientoDonacion {

    private EstancamientoDonacion() {
    }

    public static long diasEnEstado(Donacion d, Instant ahora, ZoneId zona) {
        Instant desde = d.getEstadoDesdeEfectivo(zona);
        if (desde == null || desde.isAfter(ahora)) {
            return 0;
        }
        return Duration.between(desde, ahora).toDays();
    }

    public static boolean estaEstancada(Donacion d, Instant ahora, ZoneId zona, VentanasDonacion ventanas) {
        Instant desde = d.getEstadoDesdeEfectivo(zona);
        if (desde == null) {
            return false;
        }
        Duration enEstado = Duration.between(desde, ahora);
        EstadoDonacion estado = d.getEstado();
        if (estado == EstadoDonacion.ACEPTADA || estado == EstadoDonacion.EN_CAMINO) {
            return enEstado.compareTo(ventanas.enCursoEstancada()) > 0;
        }
        if (estado == EstadoDonacion.PENDIENTE_CONFIRMACION) {
            return enEstado.compareTo(ventanas.confirmacionEstancada()) > 0;
        }
        return false;
    }
}
