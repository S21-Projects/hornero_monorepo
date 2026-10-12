package org.example.domain;

import org.example.user.Donante;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * N12: {@code estadoDesde} records when a donación entered its current estado. It must be updated
 * on EVERY estado change, including a plain {@code setEstado} that forgets to touch it.
 */
@DataJpaTest
class DonacionEstadoDesdeTest {

    private static final ZoneId AR = ZoneId.of("America/Argentina/Buenos_Aires");

    @Autowired
    private DonacionRepository donacionRepository;
    @Autowired
    private UsuarioRepository usuarioRepository;

    private Donacion nueva() {
        Donante donante = new Donante();
        donante.setNombre("Don");
        donante.setEmail("don-" + System.nanoTime() + "@test.com");
        donante.setPassword("hash");
        donante.setActivo(true);
        donante = (Donante) usuarioRepository.save(donante);
        Donacion d = new Donacion();
        d.setDonante(donante);
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setFechaOferta(LocalDate.now());
        return d;
    }

    @Test
    void cambiarEstado_setsEstadoAndStampsTheClockInstant() {
        Instant ahora = Instant.parse("2026-10-12T15:00:00Z");
        Donacion d = new Donacion();
        d.setEstado(EstadoDonacion.OFRECIDA);

        d.cambiarEstado(EstadoDonacion.ACEPTADA, Clock.fixed(ahora, AR));

        assertThat(d.getEstado()).isEqualTo(EstadoDonacion.ACEPTADA);
        assertThat(d.getEstadoDesde()).isEqualTo(ahora);
    }

    @Test
    void persist_withoutEstadoDesde_defaultsToNow() {
        Instant antes = Instant.now();

        Donacion guardada = donacionRepository.saveAndFlush(nueva());

        assertThat(guardada.getEstadoDesde()).isNotNull().isAfterOrEqualTo(antes);
    }

    @Test
    void persist_keepsAnExplicitEstadoDesde() {
        Instant fijo = Instant.parse("2026-01-01T00:00:00Z");
        Donacion d = nueva();
        d.setEstadoDesde(fijo);

        assertThat(donacionRepository.saveAndFlush(d).getEstadoDesde()).isEqualTo(fijo);
    }

    @Test
    void plainSetEstado_stillRefreshesEstadoDesdeOnFlush_safetyNet() {
        Donacion d = nueva();
        Instant viejo = Instant.parse("2026-01-01T00:00:00Z");
        d.setEstadoDesde(viejo);
        d = donacionRepository.saveAndFlush(d);

        d.setEstado(EstadoDonacion.ACEPTADA); // a caller that forgot cambiarEstado
        d = donacionRepository.saveAndFlush(d);

        assertThat(d.getEstadoDesde()).isAfter(viejo);
    }

    @Test
    void updateWithoutEstadoChange_keepsEstadoDesde() {
        Donacion d = nueva();
        Instant viejo = Instant.parse("2026-01-01T00:00:00Z");
        d.setEstadoDesde(viejo);
        d = donacionRepository.saveAndFlush(d);

        d.setObservaciones("cambio menor");
        d = donacionRepository.saveAndFlush(d);

        assertThat(d.getEstadoDesde()).isEqualTo(viejo);
    }

    @Test
    void estadoDesdeEfectivo_nullFallsBackToStartOfFechaOfertaInBuenosAires() {
        Donacion d = new Donacion();
        d.setFechaOferta(LocalDate.of(2026, 10, 1));

        assertThat(d.getEstadoDesdeEfectivo(AR))
                .isEqualTo(LocalDate.of(2026, 10, 1).atStartOfDay(AR).toInstant());
    }

    @Test
    void estadoDesdeEfectivo_prefersTheStoredValue() {
        Donacion d = new Donacion();
        d.setFechaOferta(LocalDate.of(2026, 10, 1));
        d.setEstadoDesde(Instant.parse("2026-10-05T12:00:00Z"));

        assertThat(d.getEstadoDesdeEfectivo(AR)).isEqualTo(Instant.parse("2026-10-05T12:00:00Z"));
    }

    @Test
    void fechaLimiteFallback_isTheLastFechaOfertaWhoseStartOfDayIsBeforeTheCutoff() {
        // cutoff at 12:00 on the 5th: the 5th's start-of-day (00:00) is before it, the 6th's is not.
        Instant corte = LocalDate.of(2026, 10, 5).atTime(12, 0).atZone(AR).toInstant();
        assertThat(Donacion.fechaLimiteFallback(corte, AR)).isEqualTo(LocalDate.of(2026, 10, 5));
        // cutoff exactly at midnight: the 5th's start-of-day is NOT strictly before it.
        Instant medianoche = LocalDate.of(2026, 10, 5).atStartOfDay(AR).toInstant();
        assertThat(Donacion.fechaLimiteFallback(medianoche, AR)).isEqualTo(LocalDate.of(2026, 10, 4));
    }
}
