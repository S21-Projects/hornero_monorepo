package org.example.acreditacion.dto;

import org.example.domain.EstadoEvidencia;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEvidencia;

import java.time.Instant;
import java.time.LocalDate;

public record EvidenciaResponse(
        Long id,
        Long organizacionId,
        RequisitoAcreditacion requisito,
        TipoEvidencia tipoEvidencia,
        String declaracion,
        LocalDate validoDesde,
        LocalDate validoHasta,
        EstadoEvidencia estado,
        boolean expirada,
        Long cargadoPor,
        Instant cargadoEn,
        Long revisadoPor,
        Instant revisadoEn,
        String observacion) {

    public static EvidenciaResponse from(org.example.domain.OrganizacionEvidencia evidencia) {
        return new EvidenciaResponse(
                evidencia.getId(),
                evidencia.getOrganizacion().getId(),
                evidencia.getRequisito(),
                evidencia.getTipoEvidencia(),
                evidencia.getDeclaracion(),
                evidencia.getValidoDesde(),
                evidencia.getValidoHasta(),
                evidencia.getEstado(),
                evidencia.isExpirada(),
                evidencia.getCargadoPor(),
                evidencia.getCargadoEn(),
                evidencia.getRevisadoPor(),
                evidencia.getRevisadoEn(),
                evidencia.getObservacion());
    }
}
