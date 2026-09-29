package org.example.acreditacion.dto;

import org.example.domain.EstadoRequisitoLegajo;
import org.example.domain.NivelAcreditacion;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEvidencia;

import java.time.Instant;
import java.time.LocalDate;

public record RequisitoEnLegajo(
        RequisitoAcreditacion requisito,
        NivelAcreditacion nivelExigido,
        EstadoRequisitoLegajo estado,
        TipoEvidencia tipoEvidencia,
        String declaracion,
        LocalDate validoDesde,
        LocalDate validoHasta,
        boolean expirada,
        String auditorNombre,
        Instant auditadoEn,
        /**
         * R2 key under {@code org-evidencia/{orgId}/} for FOTO/DOCUMENTO evidence — additive field
         * (tesis-core-features task 2.24, AD-12 follow-up). {@code null} for DECLARACION evidence
         * and for FALTANTE requisitos with no evidence row yet. Consumed only by
         * {@code ts_hornero_admin}'s authenticated evidence-file route; never exposed on a public
         * endpoint (the owning {@code /legajo} route is ADMINISTRADOR/owning-REFERENTE only).
         */
        String objectKey) {
}
