package org.example.donacion;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * N12/D4: the configurable windows of the stale-donations policy, in days. An unanswered offer or
 * proposal is auto-resolved after its window; accepted/en-camino and pending-confirmation
 * donations are only flagged for the admin after theirs.
 */
@Component
public record VentanasDonacion(
        @Value("${app.donaciones.oferta-sin-respuesta-dias:7}") int ofertaSinRespuestaDias,
        @Value("${app.donaciones.propuesta-sin-respuesta-dias:3}") int propuestaSinRespuestaDias,
        @Value("${app.donaciones.en-curso-estancada-dias:14}") int enCursoEstancadaDias,
        @Value("${app.donaciones.confirmacion-estancada-dias:7}") int confirmacionEstancadaDias) {

    public static final VentanasDonacion POR_DEFECTO = new VentanasDonacion(7, 3, 14, 7);

    public Duration ofertaSinRespuesta() {
        return Duration.ofDays(ofertaSinRespuestaDias);
    }

    public Duration propuestaSinRespuesta() {
        return Duration.ofDays(propuestaSinRespuestaDias);
    }

    public Duration enCursoEstancada() {
        return Duration.ofDays(enCursoEstancadaDias);
    }

    public Duration confirmacionEstancada() {
        return Duration.ofDays(confirmacionEstancadaDias);
    }
}
