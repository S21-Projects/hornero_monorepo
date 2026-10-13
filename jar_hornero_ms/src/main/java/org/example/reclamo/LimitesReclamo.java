package org.example.reclamo;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Anti-spam limits of the claim flow, read from {@code app.reclamo.*}: how many claims one referente
 * may have PENDIENTE at once, and how many they may create inside a rolling window (any state counts).
 */
@Component
public record LimitesReclamo(
        @Value("${app.reclamo.pendientes-max:5}") int pendientesMax,
        @Value("${app.reclamo.diario-max:5}") int diarioMax,
        @Value("${app.reclamo.window-hours:24}") long windowHours) {

    public static final LimitesReclamo POR_DEFECTO = new LimitesReclamo(5, 5, 24);

    public Duration ventana() {
        return Duration.ofHours(windowHours);
    }
}
