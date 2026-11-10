package org.example.asignacion.dto;

import java.time.Instant;

/** One triggered ronda (AD-9), including a {@code FALLIDA} one — see {@code RondaService}. */
public record RondaResponse(
        Long id,
        Instant ejecutadaEn,
        Instant finalizadaEn,
        Long ejecutadaPor,
        /** Resolved from {@code usuarios} by {@code ejecutadaPor} (T6); {@code null} when the
         * executor account no longer exists — the admin UI falls back to "Admin #id" for that case. */
        String ejecutadaPorNombre,
        /** {@code MANUAL} or {@code AUTOMATICA} (N7); an automatic ronda has no executor. */
        String origen,
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
