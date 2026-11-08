package org.example.acreditacion.dto;

/**
 * Compliance history shown in the legajo, computed on read and stored nowhere: donaciones
 * {@code ENTREGADA} and {@code RECHAZADA} of the organización (same counting rule as
 * {@code CumplimientoCalculator}). {@code tasa} is the plain ratio
 * {@code entregadas / (entregadas + rechazadas)}, or {@code null} when there is no history. It is
 * NOT the smoothed term the ronda uses in the score.
 */
public record CumplimientoEnLegajo(int entregadas, int rechazadas, Double tasa) {

    public static CumplimientoEnLegajo de(int entregadas, int rechazadas) {
        int total = entregadas + rechazadas;
        Double tasa = total == 0 ? null : (double) entregadas / total;
        return new CumplimientoEnLegajo(entregadas, rechazadas, tasa);
    }
}
