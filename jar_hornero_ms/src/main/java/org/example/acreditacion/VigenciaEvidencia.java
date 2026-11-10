package org.example.acreditacion;

import java.time.LocalDate;

/**
 * RN-04 date rules, pure functions with no Spring dependency. Evidence expires a configurable
 * number of months after approval; a date already on the row that is earlier is kept, because a
 * document that expires sooner must not be extended by the approval.
 */
public final class VigenciaEvidencia {

    public static final int MESES_POR_DEFECTO = 12;
    public static final int GRACIA_DIAS_POR_DEFECTO = 30;
    public static final int RECORDATORIO_DIAS_POR_DEFECTO = 30;

    private VigenciaEvidencia() {
    }

    /** {@code min(hoy + meses, existente)}; a null {@code existente} means "no date yet". */
    public static LocalDate vencimientoAlAprobar(LocalDate hoy, int meses, LocalDate existente) {
        LocalDate porPolitica = hoy.plusMonths(meses);
        return existente != null && existente.isBefore(porPolitica) ? existente : porPolitica;
    }

    /** Last day of the grace period, or null when the evidence has no expiry date. */
    public static LocalDate finDeGracia(LocalDate validoHasta, int graciaDias) {
        return validoHasta == null ? null : validoHasta.plusDays(graciaDias);
    }

    /** True only after the last day of grace has passed. */
    public static boolean graciaVencida(LocalDate validoHasta, int graciaDias, LocalDate hoy) {
        LocalDate fin = finDeGracia(validoHasta, graciaDias);
        return fin != null && hoy.isAfter(fin);
    }
}
