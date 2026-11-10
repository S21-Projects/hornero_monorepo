package org.example.acreditacion.dto;

import org.example.domain.NivelAcreditacion;

import java.time.Instant;
import java.util.List;

/**
 * `specs/organizacion-legajo/spec.md`: assembled server-side (AD-11), proxied unmodified by the
 * BFF, rendered/printed by `ts_hornero_admin`. {@code disclosure} is a server-owned constant so no
 * client can omit the not-system-verified statement.
 */
public record LegajoResponse(
        Long organizacionId,
        String nombre,
        String slug,
        String direccion,
        NivelAcreditacion nivel,
        Instant nivelDesde,
        List<RequisitoEnLegajo> requisitos,
        List<EventoResponse> eventos,
        CumplimientoEnLegajo cumplimiento,
        String disclosure) {
}
