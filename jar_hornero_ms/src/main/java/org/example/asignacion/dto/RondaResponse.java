package org.example.asignacion.dto;

import java.time.Instant;

/** One triggered ronda (AD-9), including a {@code FALLIDA} one — see {@code RondaService}. */
public record RondaResponse(
        Long id,
        Instant ejecutadaEn,
        Instant finalizadaEn,
        Long ejecutadaPor,
        String estado,
        String error,
        int versionContrato,
        int donacionesConsideradas,
        int candidatosConsiderados,
        int asignadas,
        int sinAsignar,
        int descartadas,
        Double scoreTotal,
        Double pesoDeficit,
        Double pesoUrgencia,
        Double pesoProximidad,
        Double pesoEspera,
        Double pesoCumplimiento
) {}
