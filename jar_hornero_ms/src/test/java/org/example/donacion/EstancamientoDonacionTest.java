package org.example.donacion;

import org.example.domain.Donacion;
import org.example.domain.EstadoDonacion;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

/** N12/D4: "estancada" is computed from estadoDesde + the configured windows, never stored. */
class EstancamientoDonacionTest {

    private static final ZoneId AR = ZoneId.of("America/Argentina/Buenos_Aires");
    private static final Instant AHORA = Instant.parse("2026-10-12T15:00:00Z");
    private static final VentanasDonacion V = VentanasDonacion.POR_DEFECTO;

    private Donacion en(EstadoDonacion estado, Duration hace) {
        Donacion d = new Donacion();
        d.setEstado(estado);
        d.setFechaOferta(LocalDate.of(2026, 1, 1));
        d.setEstadoDesde(AHORA.minus(hace));
        return d;
    }

    @Test
    void aceptadaAndEnCamino_staleOnlyStrictlyPastFourteenDays() {
        assertThat(EstancamientoDonacion.estaEstancada(en(EstadoDonacion.ACEPTADA, Duration.ofDays(14)), AHORA, AR, V)).isFalse();
        assertThat(EstancamientoDonacion.estaEstancada(en(EstadoDonacion.ACEPTADA, Duration.ofDays(14).plusSeconds(1)), AHORA, AR, V)).isTrue();
        assertThat(EstancamientoDonacion.estaEstancada(en(EstadoDonacion.EN_CAMINO, Duration.ofDays(15)), AHORA, AR, V)).isTrue();
        assertThat(EstancamientoDonacion.estaEstancada(en(EstadoDonacion.EN_CAMINO, Duration.ofDays(3)), AHORA, AR, V)).isFalse();
    }

    @Test
    void pendienteConfirmacion_staleOnlyStrictlyPastSevenDays() {
        assertThat(EstancamientoDonacion.estaEstancada(en(EstadoDonacion.PENDIENTE_CONFIRMACION, Duration.ofDays(7)), AHORA, AR, V)).isFalse();
        assertThat(EstancamientoDonacion.estaEstancada(en(EstadoDonacion.PENDIENTE_CONFIRMACION, Duration.ofDays(8)), AHORA, AR, V)).isTrue();
    }

    @Test
    void ofrecidaAndTerminalStates_areNeverFlagged() {
        assertThat(EstancamientoDonacion.estaEstancada(en(EstadoDonacion.OFRECIDA, Duration.ofDays(100)), AHORA, AR, V)).isFalse();
        assertThat(EstancamientoDonacion.estaEstancada(en(EstadoDonacion.ENTREGADA, Duration.ofDays(100)), AHORA, AR, V)).isFalse();
        assertThat(EstancamientoDonacion.estaEstancada(en(EstadoDonacion.CANCELADA, Duration.ofDays(100)), AHORA, AR, V)).isFalse();
    }

    @Test
    void windowsComeFromConfiguration() {
        VentanasDonacion cortas = new VentanasDonacion(7, 3, 2, 1);
        assertThat(EstancamientoDonacion.estaEstancada(en(EstadoDonacion.ACEPTADA, Duration.ofDays(3)), AHORA, AR, cortas)).isTrue();
        assertThat(EstancamientoDonacion.estaEstancada(en(EstadoDonacion.PENDIENTE_CONFIRMACION, Duration.ofDays(2)), AHORA, AR, cortas)).isTrue();
    }

    @Test
    void diasEnEstado_isWholeDaysSinceEstadoDesde_andUsesTheNullFallback() {
        assertThat(EstancamientoDonacion.diasEnEstado(en(EstadoDonacion.ACEPTADA, Duration.ofDays(15).plusHours(5)), AHORA, AR)).isEqualTo(15);
        Donacion sinDesde = new Donacion();
        sinDesde.setEstado(EstadoDonacion.ACEPTADA);
        sinDesde.setFechaOferta(LocalDate.of(2026, 9, 28)); // start of day AR = 2026-09-28T03:00Z
        assertThat(EstancamientoDonacion.diasEnEstado(sinDesde, AHORA, AR)).isEqualTo(14);
        assertThat(EstancamientoDonacion.estaEstancada(sinDesde, AHORA, AR, V)).isTrue();
    }

    @Test
    void diasEnEstado_withNoDateAtAll_isZeroAndNotStale() {
        Donacion d = new Donacion();
        d.setEstado(EstadoDonacion.ACEPTADA);
        assertThat(EstancamientoDonacion.diasEnEstado(d, AHORA, AR)).isZero();
        assertThat(EstancamientoDonacion.estaEstancada(d, AHORA, AR, V)).isFalse();
    }
}
