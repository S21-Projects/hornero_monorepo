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
        Instant auditadoEn) {
}
