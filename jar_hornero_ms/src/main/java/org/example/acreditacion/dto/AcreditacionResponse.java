package org.example.acreditacion.dto;

import org.example.domain.NivelAcreditacion;

import java.time.Instant;

public record AcreditacionResponse(
        Long organizacionId,
        NivelAcreditacion nivel,
        Instant nivelDesde) {
}
