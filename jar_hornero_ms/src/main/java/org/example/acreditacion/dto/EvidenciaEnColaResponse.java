package org.example.acreditacion.dto;

import org.example.domain.EstadoEvidencia;
import org.example.domain.NivelAcreditacion;
import org.example.domain.OrganizacionEvidencia;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEvidencia;

import java.time.Instant;
import java.time.LocalDate;

/**
 * One row of the cross-org audit queue (AD-8): {@link EvidenciaResponse}'s fields plus the
 * organizacion's display name and its current accreditation level, since a single-org queue has
 * no need to show either.
 */
public record EvidenciaEnColaResponse(
        Long id,
        Long organizacionId,
        String organizacionNombre,
        NivelAcreditacion organizacionNivel,
        RequisitoAcreditacion requisito,
        NivelAcreditacion nivelExigido,
        TipoEvidencia tipoEvidencia,
        String objectKey,
        String declaracion,
        LocalDate validoDesde,
        LocalDate validoHasta,
        EstadoEvidencia estado,
        boolean expirada,
        Long cargadoPor,
        Instant cargadoEn,
        Long revisadoPor,
        Instant revisadoEn,
        String observacion,
        /** RN-04: last day of the grace period for an expired evidence; {@code null} when not expired. */
        LocalDate graciaHasta,
        /** RN-04: true once the grace period is over. */
        boolean graciaVencida) {

    public static EvidenciaEnColaResponse from(OrganizacionEvidencia evidencia) {
        return from(evidencia, org.example.acreditacion.VigenciaEvidencia.GRACIA_DIAS_POR_DEFECTO);
    }

    public static EvidenciaEnColaResponse from(OrganizacionEvidencia evidencia, int graciaDias) {
        boolean vencida = evidencia.getEstado() == EstadoEvidencia.VENCIDA
                || (evidencia.getEstado() == EstadoEvidencia.APROBADA && evidencia.isExpirada());
        LocalDate graciaHasta = vencida
                ? org.example.acreditacion.VigenciaEvidencia.finDeGracia(evidencia.getValidoHasta(), graciaDias)
                : null;
        return new EvidenciaEnColaResponse(
                evidencia.getId(),
                evidencia.getOrganizacion().getId(),
                evidencia.getOrganizacion().getNombre(),
                evidencia.getOrganizacion().getNivel(),
                evidencia.getRequisito(),
                evidencia.getRequisito().getNivelExigido(),
                evidencia.getTipoEvidencia(),
                evidencia.getObjectKey(),
                evidencia.getDeclaracion(),
                evidencia.getValidoDesde(),
                evidencia.getValidoHasta(),
                evidencia.getEstado(),
                evidencia.isExpirada(),
                evidencia.getCargadoPor(),
                evidencia.getCargadoEn(),
                evidencia.getRevisadoPor(),
                evidencia.getRevisadoEn(),
                evidencia.getObservacion(),
                graciaHasta,
                graciaHasta != null && LocalDate.now().isAfter(graciaHasta));
    }
}
