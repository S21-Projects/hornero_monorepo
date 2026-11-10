package org.example.asignacion.dto;

import java.time.Instant;
import java.time.LocalDate;

/**
 * One {@code Asignacion} history row for {@code GET /api/donaciones/{id}/asignaciones} — owner
 * donante, any referente involved in the donación's assignment history, or admin
 * (`specs/ronda-asignacion/spec.md`).
 *
 * <p>{@code peso*} fields (task 5f.15) are the weights the ronda actually applied — a snapshot
 * taken from {@code asignacion.getRonda()}, not the worker's pre-6a hardcoded defaults the admin
 * SPA used to fall back to. Null only for rows whose ronda never recorded a weight snapshot
 * (pre-AD-9 data).</p>
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
        Instant resueltaEn,
        Double pesoDeficit,
        Double pesoUrgencia,
        Double pesoProximidad,
        Double pesoEspera,
        Double pesoCumplimiento
) {}
