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
 * <p>Modalidad-awareness (the {@code FONDO_COMUN} devolución entry, {@code OFRECIDA -> OFRECIDA})
 * is added in slice 5b once {@code ModalidadDonacion} exists; this slice (3a) only adds the
 * delivery-code entries on top of the pre-existing lifecycle.
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
