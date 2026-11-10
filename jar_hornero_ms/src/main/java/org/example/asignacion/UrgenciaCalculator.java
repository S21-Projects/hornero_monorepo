package org.example.asignacion;

import org.example.domain.PrioridadNecesidad;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * AD-9 input derivation: {@code urgencia = max(base(prioridad), vencimiento)}.
 */
public final class UrgenciaCalculator {

    private static final double BASE_URGENTE = 1.0;
    private static final double BASE_MEDIA = 0.6;
    private static final double BASE_NORMAL = 0.3;
    private static final long VENTANA_VENCIMIENTO_DIAS = 30;

    private UrgenciaCalculator() {
    }

    public static double calcular(PrioridadNecesidad prioridad, LocalDate fechaVencimiento, LocalDate hoy) {
        return Math.max(base(prioridad), vencimiento(fechaVencimiento, hoy));
    }

    private static double base(PrioridadNecesidad prioridad) {
        return switch (prioridad) {
            case URGENTE -> BASE_URGENTE;
            case MEDIA -> BASE_MEDIA;
            case NORMAL -> BASE_NORMAL;
        };
    }

    private static double vencimiento(LocalDate fechaVencimiento, LocalDate hoy) {
        if (fechaVencimiento == null) {
            return 0.0;
        }
        long diasHastaVencimiento = ChronoUnit.DAYS.between(hoy, fechaVencimiento);
        double valor = 1.0 - ((double) diasHastaVencimiento / VENTANA_VENCIMIENTO_DIAS);
        return Math.max(0.0, Math.min(1.0, valor));
    }
}
