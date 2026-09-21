package org.example.acreditacion;

import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvidencia;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEvidencia;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Record-and-warn expiry (AD-9, `specs/organizacion-evidencia/spec.md` "Record-and-Warn Expiry"):
 * {@code expirada} is derived on read, never persisted, and no scheduled process recomputes it.
 *
 * <p>Deviation from strict RED-before-GREEN ordering: {@code isExpirada()} was implemented as
 * part of the {@code OrganizacionEvidencia} entity (task 2.2), the same compile-cohesion reason
 * Phase 1's apply-progress documents for out-of-order type creation — a derived getter on a brand
 * new entity has no meaningful "doesn't exist yet" state to RED against without deleting the
 * method first. This test triangulates the three boundary cases the spec names.
 */
class ExpiracionTest {

    @Test
    void validoHastaNullNeverExpires() {
        assertThat(evidenciaConValidoHasta(null).isExpirada()).isFalse();
    }

    @Test
    void validoHastaInThePastIsExpired() {
        assertThat(evidenciaConValidoHasta(LocalDate.now().minusDays(1)).isExpirada()).isTrue();
    }

    @Test
    void validoHastaTodayIsNotYetExpired() {
        assertThat(evidenciaConValidoHasta(LocalDate.now()).isExpirada()).isFalse();
    }

    @Test
    void noScheduledMethodExistsInTheAcreditacionPackage() {
        boolean hasScheduled = java.util.Arrays.stream(AcreditacionService.class.getDeclaredMethods())
                .anyMatch(m -> m.isAnnotationPresent(org.springframework.scheduling.annotation.Scheduled.class));
        assertThat(hasScheduled).isFalse();
    }

    private OrganizacionEvidencia evidenciaConValidoHasta(LocalDate validoHasta) {
        Organizacion org = new Organizacion();
        org.setNombre("Comedor Expiracion");
        org.setEstado(EstadoOrganizacion.PENDIENTE);
        org.setNivel(NivelAcreditacion.N0);
        return OrganizacionEvidencia.nueva(org, RequisitoAcreditacion.NO_DISCRIMINACION,
                TipoEvidencia.DECLARACION, "declaración", LocalDate.now(), validoHasta, 1L);
    }
}
