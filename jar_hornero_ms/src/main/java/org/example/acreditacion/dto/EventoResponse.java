package org.example.acreditacion.dto;

import org.example.domain.NivelAcreditacion;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEventoOrganizacion;

import java.time.Instant;

/**
 * {@code actorUsuarioId} is nulled out by the controller when a legajo is exported for the
 * owning referente rather than an admin (D-01: show the action, timestamp and actor role, not the
 * auditor's personal identity).
 */
public record EventoResponse(
        TipoEventoOrganizacion tipo,
        Instant ocurridoEn,
        String actorTipo,
        Long actorUsuarioId,
        NivelAcreditacion nivelAntes,
        NivelAcreditacion nivelDespues,
        RequisitoAcreditacion requisito,
        String motivo) {
}
