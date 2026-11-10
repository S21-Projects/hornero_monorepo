package org.example.donacion;

import org.example.domain.Donacion;
import org.example.domain.EstadoDonacion;

import java.time.Clock;
import java.time.LocalDate;

/**
 * Shared confirmation/transition logic. Used only by {@code EntregaService.verificar} (the
 * code-verified path, slice 3a) now that slice 3c-ii retired the legacy unconditional
 * {@code confirmarEntrega} button/endpoint. Design AD-5/AD-6 calls this a single
 * package-private method on {@code DonacionService}; it is a standalone class here instead
 * because {@code EntregaService}
 * lives in the {@code org.example.donacion.entrega} sub-package, and Java package-private
 * visibility does not extend to sub-packages — a public static helper is the equivalent
 * single-implementation shape without duplicating the logic in each caller.
 *
 * <p>Setting the verifier's own confirmation timestamp is idempotent: re-registering an
 * already-satisfied side changes nothing and never regresses the donation's estado.
 */
public final class ConfirmacionEntrega {

    private ConfirmacionEntrega() {
    }

    public static void registrar(Donacion donacion, ParticipantesDonacion.Parte parte, Clock clock) {
        EstadoDonacion actual = donacion.getEstado();

        if (parte == ParticipantesDonacion.Parte.DONANTE && donacion.getConfirmadaDonanteEn() == null) {
            donacion.setConfirmadaDonanteEn(clock.instant());
        } else if (parte == ParticipantesDonacion.Parte.REFERENTE && donacion.getConfirmadaReferenteEn() == null) {
            donacion.setConfirmadaReferenteEn(clock.instant());
        }
        // else: same party confirming again -> idempotent no-op on the timestamp.

        EstadoDonacion nuevo = (donacion.getConfirmadaDonanteEn() != null && donacion.getConfirmadaReferenteEn() != null)
                ? EstadoDonacion.ENTREGADA
                : EstadoDonacion.PENDIENTE_CONFIRMACION;

        if (nuevo != actual) {
            TransicionesDonacion.validar(actual, nuevo);
            donacion.cambiarEstado(nuevo, clock);
        }
        if (nuevo == EstadoDonacion.ENTREGADA && donacion.getFechaEntrega() == null) {
            donacion.setFechaEntrega(LocalDate.now(clock));
        }
    }
}
