package org.example.reporte.dto;

import org.example.domain.EstadoReporte;
import org.example.domain.MotivoReporte;

import java.time.Instant;

public record ReporteResponse(
        Long id,
        Long organizacionId,
        String organizacionNombre,
        String organizacionSlug,
        String organizacionDireccion,
        Long reportanteId,
        String reportanteNombre,
        String reportanteEmail,
        MotivoReporte motivo,
        Long organizacionDuplicadaId,
        String organizacionDuplicadaNombre,
        String organizacionDuplicadaSlug,
        String detalle,
        EstadoReporte estado,
        String notaResolucion,
        String resueltoPorNombre,
        Instant creadoEn,
        Instant resueltoEn) {
}
