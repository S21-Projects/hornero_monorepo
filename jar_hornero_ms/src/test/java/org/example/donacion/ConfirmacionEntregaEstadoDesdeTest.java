package org.example.donacion;

import org.example.domain.Donacion;
import org.example.domain.EstadoDonacion;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

/** N12: the delivery-confirmation transitions stamp estadoDesde too. */
class ConfirmacionEntregaEstadoDesdeTest {

    private static final ZoneId AR = ZoneId.of("America/Argentina/Buenos_Aires");
    private final Instant t0 = Instant.parse("2026-10-01T10:00:00Z");
    private final Instant t1 = Instant.parse("2026-10-12T10:00:00Z");

    @Test
    void firstConfirmation_movesToPendienteAndStampsEstadoDesde_secondToEntregada() {
        Donacion d = new Donacion();
        d.setEstado(EstadoDonacion.EN_CAMINO);
        d.setEstadoDesde(t0.minusSeconds(86400));

        ConfirmacionEntrega.registrar(d, ParticipantesDonacion.Parte.DONANTE, Clock.fixed(t0, AR));
        assertThat(d.getEstado()).isEqualTo(EstadoDonacion.PENDIENTE_CONFIRMACION);
        assertThat(d.getEstadoDesde()).isEqualTo(t0);

        ConfirmacionEntrega.registrar(d, ParticipantesDonacion.Parte.REFERENTE, Clock.fixed(t1, AR));
        assertThat(d.getEstado()).isEqualTo(EstadoDonacion.ENTREGADA);
        assertThat(d.getEstadoDesde()).isEqualTo(t1);
    }

    @Test
    void repeatedConfirmationOfTheSameParty_doesNotResetEstadoDesde() {
        Donacion d = new Donacion();
        d.setEstado(EstadoDonacion.EN_CAMINO);
        ConfirmacionEntrega.registrar(d, ParticipantesDonacion.Parte.DONANTE, Clock.fixed(t0, AR));

        ConfirmacionEntrega.registrar(d, ParticipantesDonacion.Parte.DONANTE, Clock.fixed(t1, AR));

        assertThat(d.getEstadoDesde()).isEqualTo(t0);
    }
}
