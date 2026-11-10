package org.example.donacion;

import org.example.domain.EstadoDonacion;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * AD-5's single coordinated transition table. {@code overrideEstado} (ADMINISTRADOR) stays outside
 * this table exactly as before — it never calls {@link #validar}.
 *
 * <p>This table is modalidad-agnostic. The {@code FONDO_COMUN} rules live in
 * {@code DonacionService.decidir}: a referente's rejection of an assigned pool donation is a
 * devolución to the pool ({@code OFRECIDA -> OFRECIDA}, necesidad cleared) intercepted before this
 * table is consulted, and an unassigned pool donation has no referente party, so
 * {@code ParticipantesDonacion} rejects accept/reject on it before any transition is validated.
 */
public final class TransicionesDonacion {

    private static final Map<EstadoDonacion, Set<EstadoDonacion>> PERMITIDAS =
            new EnumMap<>(EstadoDonacion.class);

    static {
        PERMITIDAS.put(EstadoDonacion.OFRECIDA,
                EnumSet.of(EstadoDonacion.ACEPTADA, EstadoDonacion.RECHAZADA, EstadoDonacion.CANCELADA));
        PERMITIDAS.put(EstadoDonacion.ACEPTADA,
                EnumSet.of(EstadoDonacion.EN_CAMINO, EstadoDonacion.CANCELADA, EstadoDonacion.PENDIENTE_CONFIRMACION));
        PERMITIDAS.put(EstadoDonacion.EN_CAMINO,
                EnumSet.of(EstadoDonacion.CANCELADA, EstadoDonacion.PENDIENTE_CONFIRMACION));
        PERMITIDAS.put(EstadoDonacion.PENDIENTE_CONFIRMACION,
                EnumSet.of(EstadoDonacion.ENTREGADA));
    }

    private TransicionesDonacion() {
    }

    public static boolean esValida(EstadoDonacion desde, EstadoDonacion hacia) {
        return PERMITIDAS.getOrDefault(desde, Set.of()).contains(hacia);
    }

    public static void validar(EstadoDonacion desde, EstadoDonacion hacia) {
        if (!esValida(desde, hacia)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid state transition: " + desde + " -> " + hacia);
        }
    }
}
