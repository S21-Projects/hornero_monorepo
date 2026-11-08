package org.example.acreditacion;

import org.example.actividad.Actividad;
import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.actividad.TipoActor;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvidencia;
import org.example.domain.OrganizacionEvidenciaRepository;
import org.example.domain.OrganizacionRepository;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEvidencia;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** An administrator downloading accreditation evidence leaves an activity row: actor, evidence, organization. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class EvidenciaDescargaAuditorTest {

    @Autowired
    private EvidenciaDescargaAuditor auditor;
    @Autowired
    private ActividadService actividadService;
    @Autowired
    private OrganizacionRepository organizacionRepository;
    @Autowired
    private OrganizacionEvidenciaRepository evidenciaRepository;

    @AfterEach
    void limpiar() {
        SecurityContextHolder.clearContext();
    }

    private Organizacion org() {
        Organizacion o = new Organizacion();
        o.setNombre("Comedor Descarga");
        o.setSlug("comedor-descarga-" + System.nanoTime());
        o.setEstado(EstadoOrganizacion.PENDIENTE);
        o.setNivel(NivelAcreditacion.N0);
        return organizacionRepository.save(o);
    }

    private List<Actividad> filas(Long evidenciaId) {
        return actividadService.buscar(
                new ActividadService.Filtro(null, TipoActividad.EVIDENCIA_ACREDITACION_DESCARGADA, null,
                        "EVIDENCIA", evidenciaId, null, null),
                PageRequest.of(0, 20)).getContent();
    }

    @Test
    void recordsActorEvidenceAndOrganizationForAnAdminDownload() {
        Organizacion o = org();
        String key = "org-evidencia/" + o.getId() + "/descarga-" + System.nanoTime() + ".pdf";
        OrganizacionEvidencia e = evidenciaRepository.save(OrganizacionEvidencia.nueva(o,
                RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.DOCUMENTO, null, LocalDate.now(), null,
                1L, key));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                42L, null, List.of(new SimpleGrantedAuthority("ROLE_ADMINISTRADOR"))));

        auditor.registrar(o.getId(), key);

        List<Actividad> filas = filas(e.getId());
        assertThat(filas).hasSize(1);
        Actividad a = filas.get(0);
        assertThat(a.getActorUsuarioId()).isEqualTo(42L);
        assertThat(a.getActorTipo()).isEqualTo(TipoActor.ADMINISTRADOR);
        assertThat(a.getEntidadId()).isEqualTo(e.getId());
        assertThat(a.getDetalle()).contains("organizacion " + o.getId());
        // The object key (a path into the bucket) is not copied into the log.
        assertThat(a.getDetalle()).doesNotContain("org-evidencia/");
    }

    @Test
    void ignoresAKeyWithNoRow() {
        Organizacion o = org();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                42L, null, List.of(new SimpleGrantedAuthority("ROLE_ADMINISTRADOR"))));

        auditor.registrar(o.getId(), "org-evidencia/" + o.getId() + "/no-existe.jpg");

        assertThat(actividadService.buscar(
                new ActividadService.Filtro(null, TipoActividad.EVIDENCIA_ACREDITACION_DESCARGADA, null,
                        "EVIDENCIA", 999_999L, null, null), PageRequest.of(0, 5)).getContent()).isEmpty();
    }
}
