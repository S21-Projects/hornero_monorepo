package org.example.asignacion.dto;

import java.time.Instant;
import java.time.LocalDate;

/**
 * One {@code Asignacion} history row for {@code GET /api/donaciones/{id}/asignaciones} — owner
 * donante, any referente involved in the donación's assignment history, or admin
 * (`specs/ronda-asignacion/spec.md`).
 */
public record AsignacionResponse(
        Long id,
        Long rondaId,
        LocalDate rondaFecha,
        Long necesidadId,
        Long organizacionId,
        String organizacionNombre,
        String estado,
        double score,
        double costoOportunidad,
        double distanciaKm,
        double terminoDeficit,
        double terminoUrgencia,
        double terminoProximidad,
        double terminoEspera,
        Double terminoCumplimiento,
        String deficitFuente,
        String codigoRadio,
        Instant creadaEn,
        Instant resueltaEn
) {}
