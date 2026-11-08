package org.example.acreditacion;

import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrganizacionRepository;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEventoOrganizacion;
import org.example.domain.TipoEvidencia;
import org.example.user.Administrador;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * C4: every accreditation decision made by an administrator must name the administrator in the
 * event row (actor_usuario_id and actor_tipo), not only in the free text.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Transactional
class EventoActorTest {

    @Autowired private AcreditacionService acreditacionService;
    @Autowired private OrganizacionRepository organizacionRepository;
    @Autowired private OrganizacionEventoRepository eventoRepository;
    @Autowired private UsuarioRepository usuarioRepository;

    private Administrador admin() {
        return usuarioRepository.save(new Administrador(null, "Admin actor", "actor-" + System.nanoTime() + "@test.com", "x", true));
    }

    private Organizacion organizacion() {
        Organizacion o = new Organizacion();
        o.setNombre("Comedor actor");
        o.setSlug("comedor-actor-" + System.nanoTime());
        o.setEstado(EstadoOrganizacion.PENDIENTE);
        o.setNivel(NivelAcreditacion.N0);
        return organizacionRepository.save(o);
    }

    private OrganizacionEvento ultimo(Long orgId, TipoEventoOrganizacion tipo) {
        List<OrganizacionEvento> eventos = eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(orgId);
        return eventos.stream().filter(e -> e.getTipo() == tipo).reduce((a, b) -> b).orElseThrow();
    }

    private void assertActor(OrganizacionEvento e, Administrador admin) {
        assertThat(e.getActorUsuarioId()).isEqualTo(admin.getId());
        assertThat(e.getActorTipo()).isEqualTo("ADMINISTRADOR");
    }

    @Test
    void evidenceApprovalAndObservationRecordTheAdministrator() {
        Administrador admin = admin();
        Organizacion org = organizacion();
        var aprobada = acreditacionService.cargarEvidencia(org, RequisitoAcreditacion.NO_DISCRIMINACION,
                TipoEvidencia.DECLARACION, "d", LocalDate.now(), null, admin.getId());
        acreditacionService.aprobarEvidencia(aprobada.getId(), admin.getId());
        var observada = acreditacionService.cargarEvidencia(org, RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO,
                TipoEvidencia.DECLARACION, "d", LocalDate.now(), null, admin.getId());
        acreditacionService.observarEvidencia(observada.getId(), "falta firma", admin.getId());

        assertActor(ultimo(org.getId(), TipoEventoOrganizacion.REQUISITO_APROBADO), admin);
        assertActor(ultimo(org.getId(), TipoEventoOrganizacion.REQUISITO_OBSERVADO), admin);
    }

    @Test
    void levelRaiseAndLowerRecordTheAdministrator() {
        Administrador admin = admin();
        Organizacion org = organizacion();
        for (RequisitoAcreditacion r : List.of(RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO,
                RequisitoAcreditacion.NO_DISCRIMINACION, RequisitoAcreditacion.SEDE_INSCRIPTA_INDIVIDUALMENTE)) {
            var ev = acreditacionService.cargarEvidencia(org, r, TipoEvidencia.DECLARACION, "d", LocalDate.now(), null, admin.getId());
            acreditacionService.aprobarEvidencia(ev.getId(), admin.getId());
        }
        acreditacionService.cambiarNivel(org.getId(), NivelAcreditacion.N1, "cumple", admin.getId());
        acreditacionService.cambiarNivel(org.getId(), NivelAcreditacion.N0, "evidencia vencida", admin.getId());

        assertActor(ultimo(org.getId(), TipoEventoOrganizacion.NIVEL_ELEVADO), admin);
        assertActor(ultimo(org.getId(), TipoEventoOrganizacion.NIVEL_REDUCIDO), admin);
    }

    @Test
    void legacyValidationAndRejectionRecordTheAdministrator() {
        Administrador admin = admin();
        Organizacion validada = organizacion();
        acreditacionService.aplicarTransicionLegacy(validada, NivelAcreditacion.N1, admin, "Validación administrativa",
                TipoEventoOrganizacion.NIVEL_ELEVADO);
        Organizacion rechazada = organizacion();
        acreditacionService.rechazarRegistro(rechazada, admin, "no cumple");

        assertActor(ultimo(validada.getId(), TipoEventoOrganizacion.NIVEL_ELEVADO), admin);
        assertActor(ultimo(rechazada.getId(), TipoEventoOrganizacion.REGISTRO_RECHAZADO), admin);
    }
}
