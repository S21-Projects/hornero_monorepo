package org.example.reclamo.dto;

import org.example.domain.EstadoReclamo;
import org.example.domain.RolReclamo;

import java.time.Instant;
import java.util.List;

/**
 * {@code organizacionesACargo} / {@code capOrganizaciones} are filled only in the admin detail
 * (the "n/3" of the mockup); lists leave them null.
 */
public record ReclamoResponse(
        Long id,
        Long organizacionId,
        String organizacionNombre,
        String organizacionSlug,
        String organizacionDireccion,
        Long solicitanteId,
        String solicitanteNombre,
        String solicitanteEmail,
        RolReclamo rol,
        String telefono,
        String mensaje,
        List<String> evidenciaKeys,
        EstadoReclamo estado,
        String motivoRechazo,
        String resueltoPorNombre,
        Instant creadoEn,
        Instant resueltoEn,
        Integer organizacionesACargo,
        Integer capOrganizaciones) {
}
