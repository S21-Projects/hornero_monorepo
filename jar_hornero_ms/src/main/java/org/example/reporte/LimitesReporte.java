package org.example.reporte;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Daily report limit, read from {@code app.reporte.*}: how many reports one user may create inside a
 * rolling window (any state counts). The cap on simultaneously pending reports is a service constant.
 */
@Component
public record LimitesReporte(
        @Value("${app.reporte.diario-max:20}") int diarioMax,
        @Value("${app.reporte.window-hours:24}") long windowHours) {

    public static final LimitesReporte POR_DEFECTO = new LimitesReporte(20, 24);

    public Duration ventana() {
        return Duration.ofHours(windowHours);
    }
}
