package org.example.asignacion;

import org.example.domain.PrioridadNecesidad;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * AD-9: {@code urgencia = max(base(prioridad), vencimiento)}. `base`: URGENTE 1.0, MEDIA 0.6,
 * NORMAL 0.3; `vencimiento = clamp(1 - diasHastaVencimiento / 30, 0, 1)`, 0 when there is no
 * {@code fechaVencimiento} — 5c.2.
 */
class UrgenciaCalculatorTest {

    private static final LocalDate HOY = LocalDate.of(2026, 1, 1);

    @Test
    void baseUrgenteWithNoVencimientoIsOne() {
        double urgencia = UrgenciaCalculator.calcular(PrioridadNecesidad.URGENTE, null, HOY);
        assertThat(urgencia).isEqualTo(1.0);
    }

    @Test
    void baseMediaWithNoVencimientoIsPointSix() {
        double urgencia = UrgenciaCalculator.calcular(PrioridadNecesidad.MEDIA, null, HOY);
        assertThat(urgencia).isEqualTo(0.6);
    }

    @Test
    void baseNormalWithNoVencimientoIsPointThree() {
        double urgencia = UrgenciaCalculator.calcular(PrioridadNecesidad.NORMAL, null, HOY);
        assertThat(urgencia).isEqualTo(0.3);
    }

    @Test
    void vencimientoTodayIsOneAndDominatesLowerBase() {
        double urgencia = UrgenciaCalculator.calcular(PrioridadNecesidad.NORMAL, HOY, HOY);
        assertThat(urgencia).isEqualTo(1.0);
    }

    @Test
    void vencimientoIn15DaysIsHalfway() {
        double urgencia = UrgenciaCalculator.calcular(PrioridadNecesidad.NORMAL, HOY.plusDays(15), HOY);
        assertThat(urgencia).isCloseTo(0.5, within(1e-9));
    }

    @Test
    void vencimientoBeyond30DaysClampsToZeroAndBaseWins() {
        double urgencia = UrgenciaCalculator.calcular(PrioridadNecesidad.MEDIA, HOY.plusDays(90), HOY);
        assertThat(urgencia).isEqualTo(0.6);
    }

    @Test
    void vencimientoAlreadyPastClampsToOne() {
        double urgencia = UrgenciaCalculator.calcular(PrioridadNecesidad.NORMAL, HOY.minusDays(5), HOY);
        assertThat(urgencia).isEqualTo(1.0);
    }

    @Test
    void higherBaseWinsOverLowerVencimiento() {
        // URGENTE base (1.0) already dominates any vencimiento term.
        double urgencia = UrgenciaCalculator.calcular(PrioridadNecesidad.URGENTE, HOY.plusDays(90), HOY);
        assertThat(urgencia).isEqualTo(1.0);
    }
}
