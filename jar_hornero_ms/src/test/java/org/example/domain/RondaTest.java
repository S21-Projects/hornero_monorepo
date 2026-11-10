package org.example.domain;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Entity persistence round-trip (AD-9's model) — 5c.3.
 */
@DataJpaTest
class RondaTest {

    @Autowired
    private RondaRepository rondaRepository;

    @Test
    void persistsAndReloadsEveryField() {
        Ronda ronda = new Ronda();
        ronda.setEjecutadaEn(Instant.parse("2026-01-01T10:00:00Z"));
        ronda.setFinalizadaEn(Instant.parse("2026-01-01T10:00:05Z"));
        ronda.setEjecutadaPor(99L);
        ronda.setEstado(EstadoRonda.COMPLETADA);
        ronda.setError(null);
        ronda.setVersionContrato(1);
        ronda.setDonacionesConsideradas(3);
        ronda.setCandidatosConsiderados(5);
        ronda.setAsignadas(2);
        ronda.setSinAsignar(1);
        ronda.setDescartadas(0);
        ronda.setScoreTotal(0.71);
        ronda.setPesoDeficit(0.30);
        ronda.setPesoUrgencia(0.25);
        ronda.setPesoProximidad(0.17);
        ronda.setPesoEspera(0.13);
        ronda.setPesoCumplimiento(null);

        Ronda saved = rondaRepository.saveAndFlush(ronda);
        Ronda reloaded = rondaRepository.findById(saved.getId()).orElseThrow();

        assertThat(reloaded.getEjecutadaEn()).isEqualTo(Instant.parse("2026-01-01T10:00:00Z"));
        assertThat(reloaded.getFinalizadaEn()).isEqualTo(Instant.parse("2026-01-01T10:00:05Z"));
        assertThat(reloaded.getEjecutadaPor()).isEqualTo(99L);
        assertThat(reloaded.getEstado()).isEqualTo(EstadoRonda.COMPLETADA);
        assertThat(reloaded.getError()).isNull();
        assertThat(reloaded.getVersionContrato()).isEqualTo(1);
        assertThat(reloaded.getDonacionesConsideradas()).isEqualTo(3);
        assertThat(reloaded.getCandidatosConsiderados()).isEqualTo(5);
        assertThat(reloaded.getAsignadas()).isEqualTo(2);
        assertThat(reloaded.getSinAsignar()).isEqualTo(1);
        assertThat(reloaded.getDescartadas()).isEqualTo(0);
        assertThat(reloaded.getScoreTotal()).isEqualTo(0.71);
        assertThat(reloaded.getPesoDeficit()).isEqualTo(0.30);
        assertThat(reloaded.getPesoUrgencia()).isEqualTo(0.25);
        assertThat(reloaded.getPesoProximidad()).isEqualTo(0.17);
        assertThat(reloaded.getPesoEspera()).isEqualTo(0.13);
        assertThat(reloaded.getPesoCumplimiento()).isNull();
    }

    @Test
    void persistsFallidaWithError() {
        Ronda ronda = new Ronda();
        ronda.setEjecutadaEn(Instant.now());
        ronda.setEjecutadaPor(1L);
        ronda.setEstado(EstadoRonda.FALLIDA);
        ronda.setError("WORKER_NO_DISPONIBLE");
        ronda.setVersionContrato(1);

        Ronda saved = rondaRepository.saveAndFlush(ronda);
        Ronda reloaded = rondaRepository.findById(saved.getId()).orElseThrow();

        assertThat(reloaded.getEstado()).isEqualTo(EstadoRonda.FALLIDA);
        assertThat(reloaded.getError()).isEqualTo("WORKER_NO_DISPONIBLE");
    }
}
