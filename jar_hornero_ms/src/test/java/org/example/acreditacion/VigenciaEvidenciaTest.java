package org.example.acreditacion;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/** RN-04: evidence expires one year after approval; an earlier date already on the row is kept. */
class VigenciaEvidenciaTest {

    private static final LocalDate HOY = LocalDate.of(2026, 11, 8);

    @Test
    void approvalWithNoExistingDateExpiresAfterTheConfiguredMonths() {
        assertThat(VigenciaEvidencia.vencimientoAlAprobar(HOY, 12, null)).isEqualTo(LocalDate.of(2027, 11, 8));
        assertThat(VigenciaEvidencia.vencimientoAlAprobar(HOY, 6, null)).isEqualTo(LocalDate.of(2027, 5, 8));
    }

    @Test
    void anEarlierExistingDateIsKeptBecauseADocumentExpiringSoonerMustNotBeExtended() {
        LocalDate antes = LocalDate.of(2027, 1, 15);
        assertThat(VigenciaEvidencia.vencimientoAlAprobar(HOY, 12, antes)).isEqualTo(antes);
    }

    @Test
    void aLaterExistingDateIsCappedAtTheConfiguredPeriod() {
        assertThat(VigenciaEvidencia.vencimientoAlAprobar(HOY, 12, LocalDate.of(2030, 1, 1)))
                .isEqualTo(LocalDate.of(2027, 11, 8));
    }

    @Test
    void anExistingDateEqualToTheComputedOneIsUnchanged() {
        LocalDate igual = LocalDate.of(2027, 11, 8);
        assertThat(VigenciaEvidencia.vencimientoAlAprobar(HOY, 12, igual)).isEqualTo(igual);
    }

    @Test
    void leapDayClampsToTheLastDayOfFebruary() {
        assertThat(VigenciaEvidencia.vencimientoAlAprobar(LocalDate.of(2028, 2, 29), 12, null))
                .isEqualTo(LocalDate.of(2029, 2, 28));
    }

    @Test
    void anExistingDateAlreadyInThePastIsKept() {
        LocalDate pasada = LocalDate.of(2026, 1, 1);
        assertThat(VigenciaEvidencia.vencimientoAlAprobar(HOY, 12, pasada)).isEqualTo(pasada);
    }

    @Test
    void graceEndsTheConfiguredDaysAfterTheExpiryDate() {
        LocalDate venceEl = LocalDate.of(2026, 10, 1);
        assertThat(VigenciaEvidencia.finDeGracia(venceEl, 30)).isEqualTo(LocalDate.of(2026, 10, 31));
        assertThat(VigenciaEvidencia.finDeGracia(null, 30)).isNull();
    }

    @Test
    void graceIsOverOnlyAfterItsLastDay() {
        LocalDate venceEl = LocalDate.of(2026, 10, 1);
        assertThat(VigenciaEvidencia.graciaVencida(venceEl, 30, LocalDate.of(2026, 10, 31))).isFalse();
        assertThat(VigenciaEvidencia.graciaVencida(venceEl, 30, LocalDate.of(2026, 11, 1))).isTrue();
        assertThat(VigenciaEvidencia.graciaVencida(null, 30, LocalDate.of(2030, 1, 1))).isFalse();
    }
}
