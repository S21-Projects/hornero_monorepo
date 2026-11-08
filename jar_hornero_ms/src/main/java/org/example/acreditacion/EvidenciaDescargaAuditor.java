package org.example.acreditacion;

import lombok.RequiredArgsConstructor;
import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.domain.OrganizacionEvidenciaRepository;
import org.springframework.stereotype.Component;

/**
 * Leaves an activity row when an administrator is authorized to download an accreditation
 * evidence file. The actor (id and role) comes from the security context. The detail names the
 * organization but never the object key.
 *
 * <p>Same-transaction write ({@link ActividadService#registrar}): if the row cannot be written the
 * authorization answers 5xx and the BFF streams nothing, so an admin cannot read personal
 * evidence without it being recorded.
 */
@Component
@RequiredArgsConstructor
public class EvidenciaDescargaAuditor {

    private final OrganizacionEvidenciaRepository evidenciaRepository;
    private final ActividadService actividadService;

    public void registrar(Long organizacionId, String objectKey) {
        evidenciaRepository.findFirstByOrganizacion_IdAndObjectKey(organizacionId, objectKey)
                .ifPresent(evidencia -> actividadService.registrar(
                        ActividadService.Registro.de(TipoActividad.EVIDENCIA_ACREDITACION_DESCARGADA)
                                .entidad("EVIDENCIA", evidencia.getId())
                                .detalle("Descarga de evidencia de la organizacion " + organizacionId)));
    }
}
