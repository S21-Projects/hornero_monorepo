package org.example.actividad.dto;

import org.example.actividad.Actividad;

import java.time.Instant;

public record ActividadResponse(
        Long id,
        Instant ocurridoEn,
        Long actorUsuarioId,
        String actorTipo,
        String accion,
        String resultado,
        String entidadTipo,
        Long entidadId,
        String detalle,
        String antes,
        String despues,
        String motivo,
        String ip,
        String emailIntento) {

    public static ActividadResponse de(Actividad a) {
        return new ActividadResponse(a.getId(), a.getOcurridoEn(), a.getActorUsuarioId(),
                a.getActorTipo().name(), a.getAccion().name(), a.getResultado().name(),
                a.getEntidadTipo(), a.getEntidadId(), a.getDetalle(), a.getAntes(), a.getDespues(),
                a.getMotivo(), a.getIp(), a.getEmailIntento());
    }
}
