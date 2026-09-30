package org.example.donacion;

import org.example.domain.Donacion;
import org.example.domain.Necesidad;
import org.example.domain.Organizacion;
import org.example.user.Referente;

import java.util.Optional;

/**
 * Null-safe resolution of "which party is this actor for this donación" (AD-5). A donación with
 * {@code necesidad == null} (a fondo común donation still waiting in the pool, slice 5b) has no
 * referente party yet: every referente-side action on it resolves to an empty {@link Optional}
 * (403 for the caller), never an NPE. This is the fix for the historical
 * {@code DonacionService.java:157} NPE risk.
 */
public final class ParticipantesDonacion {

    private ParticipantesDonacion() {
    }

    public enum Parte {
        DONANTE,
        REFERENTE
    }

    public static Optional<Parte> parteDe(Donacion donacion, Long actorId) {
        if (donacion == null || actorId == null) {
            return Optional.empty();
        }
        if (donacion.getDonante() != null && actorId.equals(donacion.getDonante().getId())) {
            return Optional.of(Parte.DONANTE);
        }
        Necesidad necesidad = donacion.getNecesidad();
        if (necesidad == null) {
            return Optional.empty();
        }
        Organizacion organizacion = necesidad.getOrganizacion();
        if (organizacion == null) {
            return Optional.empty();
        }
        Referente referente = organizacion.getReferente();
        if (referente != null && actorId.equals(referente.getId())) {
            return Optional.of(Parte.REFERENTE);
        }
        return Optional.empty();
    }
}
