package org.example.reporte.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.example.domain.MotivoReporte;

/** {@code organizacionDuplicadaId} is required iff {@code motivo} is DUPLICADO (checked by the service). */
public record CrearReporteRequest(
        @NotNull Long organizacionId,
        @NotNull MotivoReporte motivo,
        Long organizacionDuplicadaId,
        @Size(max = 1000) String detalle) {
}
