package org.example.donacion;

import org.example.domain.Donacion;
import org.example.domain.Necesidad;
import org.example.domain.Organizacion;
import org.example.user.Donante;
import org.example.user.Referente;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * `ParticipantesDonacion.parteDe` — the null-safe party resolution helper introduced by AD-5,
 * fixing the `DonacionService.java:157` NPE risk for a donation with no `necesidad` (fondo común
 * waiting in the pool, slice 5b).
 */
class ParticipantesDonacionTest {

    private final Donante donante = new Donante(2L, "Donante Test", "donante@test.com", "x", true);
    private final Referente referente = new Referente(1L, "Ref Test", "ref@test.com", "x", true);

    private Donacion donacionCon(Organizacion org) {
        Donacion d = new Donacion();
        d.setDonante(donante);
        if (org != null) {
            Necesidad necesidad = new Necesidad();
            necesidad.setOrganizacion(org);
            d.setNecesidad(necesidad);
        }
        return d;
    }

    private Organizacion organizacionCon(Referente referente) {
        Organizacion org = new Organizacion();
        org.setReferente(referente);
        return org;
    }

    @Test
    void parteDe_donanteActorId_resolvesDonante() {
        Donacion d = donacionCon(organizacionCon(referente));

        Optional<ParticipantesDonacion.Parte> parte = ParticipantesDonacion.parteDe(d, 2L);

        assertThat(parte).contains(ParticipantesDonacion.Parte.DONANTE);
    }

    @Test
    void parteDe_referenteActorId_resolvesReferente() {
        Donacion d = donacionCon(organizacionCon(referente));

        Optional<ParticipantesDonacion.Parte> parte = ParticipantesDonacion.parteDe(d, 1L);

        assertThat(parte).contains(ParticipantesDonacion.Parte.REFERENTE);
    }

    @Test
    void parteDe_unrelatedActorId_returnsEmpty() {
        Donacion d = donacionCon(organizacionCon(referente));

        assertThat(ParticipantesDonacion.parteDe(d, 999L)).isEmpty();
    }

    @Test
    void parteDe_nullNecesidad_returnsEmptyForNonDonanteActor_noNpe() {
        Donacion d = donacionCon(null);

        assertThat(ParticipantesDonacion.parteDe(d, 1L)).isEmpty();
        assertThat(ParticipantesDonacion.parteDe(d, 2L)).contains(ParticipantesDonacion.Parte.DONANTE);
    }

    @Test
    void parteDe_organizacionWithNullReferente_returnsEmpty_noNpe() {
        Organizacion org = new Organizacion();
        org.setReferente(null);
        Donacion d = donacionCon(org);

        assertThat(ParticipantesDonacion.parteDe(d, 1L)).isEmpty();
    }

    @Test
    void parteDe_nullActorId_returnsEmpty() {
        Donacion d = donacionCon(organizacionCon(referente));

        assertThat(ParticipantesDonacion.parteDe(d, null)).isEmpty();
    }
}
