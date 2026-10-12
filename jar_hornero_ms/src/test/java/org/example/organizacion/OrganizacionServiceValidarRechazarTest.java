package org.example.organizacion;

import org.example.acreditacion.AcreditacionService;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEventoRepository;
import org.example.user.Administrador;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.example.notificacion.NotificacionEvento;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Back-compat regression (design's "Backwards-Compatible Projection" section,
 * `specs/organizacion-acreditacion/spec.md` "Existing approved organizacion migrates to N1"): the
 * live admin `validar()`/`rechazar()` actions delegate to `AcreditacionService` (AD-6) instead of
 * duplicating the write, so the ladder and the legacy `estado`/`validada` flip cannot diverge.
 * Real Spring/H2 context (not Mockito) so the delegation is proven end-to-end, not by a stub.
 */
@DataJpaTest
@Import({OrganizacionService.class, AcreditacionService.class})
@org.springframework.boot.test.mock.mockito.MockBean(org.example.actividad.ActividadService.class)
@RecordApplicationEvents
class OrganizacionServiceValidarRechazarTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private OrganizacionService organizacionService;

    @Autowired
    private OrganizacionEventoRepository eventoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    private Administrador administrador;

    @Autowired
    private ApplicationEvents events;

    @BeforeEach
    void setUp() {
        administrador = usuarioRepository.save(new Administrador(null, "Admin", "admin@test.com", "x", true));
    }

    private Organizacion persistPendiente() {
        Organizacion organizacion = new Organizacion();
        organizacion.setNombre("Comedor Validar");
        organizacion.setSlug("comedor-validar-" + System.nanoTime());
        organizacion.setEstado(EstadoOrganizacion.PENDIENTE);
        organizacion.setNivel(NivelAcreditacion.N0);
        return entityManager.persistFlushFind(organizacion);
    }

    @Test
    void validarOnPendienteYieldsN1AndAprobadaAndOneEvent() {
        Organizacion organizacion = persistPendiente();

        organizacionService.validar(organizacion.getId(), administrador.getId());

        Organizacion reloaded = entityManager.find(Organizacion.class, organizacion.getId());
        assertThat(reloaded.getNivel()).isEqualTo(NivelAcreditacion.N1);
        assertThat(reloaded.getEstado()).isEqualTo(EstadoOrganizacion.APROBADA);
        assertThat(reloaded.getValidada()).isTrue();

        List<?> eventos = eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(organizacion.getId());
        assertThat(eventos).hasSize(1);
    }

    @Test
    void validar_publishesOrganizacionResueltaAprobada_andNoSeparateLevelEvent() {
        Organizacion organizacion = persistPendiente();

        organizacionService.validar(organizacion.getId(), administrador.getId());

        assertThat(events.stream(NotificacionEvento.class))
                .containsExactly(new NotificacionEvento.OrganizacionResuelta(organizacion.getId(), true));
    }

    @Test
    void rechazar_publishesOrganizacionResueltaRechazada() {
        Organizacion organizacion = persistPendiente();

        organizacionService.rechazar(organizacion.getId(), administrador.getId());

        assertThat(events.stream(NotificacionEvento.class))
                .containsExactly(new NotificacionEvento.OrganizacionResuelta(organizacion.getId(), false));
    }

    @Test
    void validar_ofAnAlreadyApprovedOrganization_publishesNothing() {
        Organizacion organizacion = persistPendiente();
        organizacionService.validar(organizacion.getId(), administrador.getId());
        events.clear();

        assertThatThrownBy(() -> organizacionService.validar(organizacion.getId(), administrador.getId()))
                .isInstanceOf(ResponseStatusException.class);

        assertThat(events.stream(NotificacionEvento.class)).isEmpty();
    }

    @Test
    void findBySlugPublicStill404sForN0AndOkForN1() {
        Organizacion pendiente = persistPendiente();
        assertThatThrownBy(() -> organizacionService.findBySlugPublic(pendiente.getSlug()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404");

        Organizacion validado = persistPendiente();
        organizacionService.validar(validado.getId(), administrador.getId());

        assertThat(organizacionService.findBySlugPublic(validado.getSlug()).isValidada()).isTrue();
    }

    @Test
    void rechazarOnPendienteSetsRechazadaWithoutRaisingNivel() {
        Organizacion organizacion = persistPendiente();

        organizacionService.rechazar(organizacion.getId(), administrador.getId());

        Organizacion reloaded = entityManager.find(Organizacion.class, organizacion.getId());
        assertThat(reloaded.getEstado()).isEqualTo(EstadoOrganizacion.RECHAZADA);
        assertThat(reloaded.getNivel()).isEqualTo(NivelAcreditacion.N0);
    }

    // --- imported (ReNaCoM) organizaciones ---

    private Organizacion persistImportada(String slug, EstadoOrganizacion estado, Double lat, Double lon) {
        Organizacion o = new Organizacion();
        o.setNombre("Comedor " + slug);
        o.setSlug(slug);
        o.setEstado(estado);
        o.setNivel(NivelAcreditacion.N0);
        o.setOrigen(org.example.domain.OrigenOrganizacion.RENACOM);
        o.setOrigenId("RN-" + slug);
        o.setAsistentesDeclarados(40);
        o.setLatitud(lat);
        o.setLongitud(lon);
        return entityManager.persistFlushFind(o);
    }

    @Test
    void validarRefusesSinReclamarAndLeavesItUntouched() {
        Organizacion o = persistImportada("sr-validar", EstadoOrganizacion.SIN_RECLAMAR, -34.0, -58.0);

        assertThatThrownBy(() -> organizacionService.validar(o.getId(), administrador.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");

        Organizacion reloaded = entityManager.find(Organizacion.class, o.getId());
        assertThat(reloaded.getEstado()).isEqualTo(EstadoOrganizacion.SIN_RECLAMAR);
        assertThat(reloaded.getNivel()).isEqualTo(NivelAcreditacion.N0);
        assertThat(eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(o.getId())).isEmpty();
    }

    @Test
    void rechazarRefusesSinReclamarAndInactiva() {
        Organizacion sinReclamar = persistImportada("sr-rechazar", EstadoOrganizacion.SIN_RECLAMAR, -34.0, -58.0);
        Organizacion inactiva = persistImportada("in-rechazar", EstadoOrganizacion.INACTIVA, -34.0, -58.0);

        assertThatThrownBy(() -> organizacionService.rechazar(sinReclamar.getId(), administrador.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
        assertThatThrownBy(() -> organizacionService.rechazar(inactiva.getId(), administrador.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
        assertThat(entityManager.find(Organizacion.class, sinReclamar.getId()).getEstado())
                .isEqualTo(EstadoOrganizacion.SIN_RECLAMAR);
    }

    @Test
    void validarRefusesInactiva() {
        Organizacion o = persistImportada("in-validar", EstadoOrganizacion.INACTIVA, -34.0, -58.0);

        assertThatThrownBy(() -> organizacionService.validar(o.getId(), administrador.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
    }

    @Test
    void findBySlugPublicServesSinReclamarWithOrigenButNotInactiva() {
        Organizacion sr = persistImportada("sr-publico", EstadoOrganizacion.SIN_RECLAMAR, -34.0, -58.0);
        Organizacion in = persistImportada("in-publico", EstadoOrganizacion.INACTIVA, -34.0, -58.0);

        var response = organizacionService.findBySlugPublic(sr.getSlug());
        assertThat(response.getEstado()).isEqualTo(EstadoOrganizacion.SIN_RECLAMAR);
        assertThat(response.getOrigen()).isEqualTo(org.example.domain.OrigenOrganizacion.RENACOM);
        assertThat(response.getAsistentesDeclarados()).isEqualTo(40);
        assertThat(response.getReferenteId()).isNull();

        assertThatThrownBy(() -> organizacionService.findBySlugPublic(in.getSlug()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404");
    }

    @Test
    void listarMapaReturnsOnlyApprovedAndUnclaimedWithCoordinates() {
        persistImportada("m-sr", EstadoOrganizacion.SIN_RECLAMAR, -34.0, -58.0);
        persistImportada("m-sr-sin-coord", EstadoOrganizacion.SIN_RECLAMAR, null, null);
        persistImportada("m-sr-media-coord", EstadoOrganizacion.SIN_RECLAMAR, -34.0, null);
        persistImportada("m-in", EstadoOrganizacion.INACTIVA, -34.0, -58.0);
        persistImportada("m-pend", EstadoOrganizacion.PENDIENTE, -34.0, -58.0);
        persistImportada("m-rech", EstadoOrganizacion.RECHAZADA, -34.0, -58.0);
        Organizacion aprobada = persistImportada("m-apr", EstadoOrganizacion.APROBADA, -31.4, -64.2);
        aprobada.setOrigen(null); // legacy row: null origen must read as PLATAFORMA
        entityManager.persistFlushFind(aprobada);

        var mapa = organizacionService.listarMapa();

        assertThat(mapa).extracting(m -> m.slug()).containsExactlyInAnyOrder("m-sr", "m-apr");
        assertThat(mapa).filteredOn(m -> m.slug().equals("m-apr")).singleElement()
                .satisfies(m -> assertThat(m.origen()).isEqualTo(org.example.domain.OrigenOrganizacion.PLATAFORMA));
    }

    @Test
    void asignarReferenteRefusesUnclaimedButAllowsUnassign() {
        Organizacion o = persistImportada("sr-asignar", EstadoOrganizacion.SIN_RECLAMAR, -34.0, -58.0);
        var req = new org.example.organizacion.dto.AsignarReferenteRequest();
        req.setReferenteId(administrador.getId());

        assertThatThrownBy(() -> organizacionService.asignarReferente(o.getId(), req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
        assertThat(entityManager.find(Organizacion.class, o.getId()).getReferente()).isNull();

        req.setReferenteId(null);
        assertThat(organizacionService.asignarReferente(o.getId(), req).getReferenteId()).isNull();
    }

    @Test
    void infoPublicaMutationsRefuseUnclaimedAndInactiva() {
        Organizacion sr = persistImportada("sr-info", EstadoOrganizacion.SIN_RECLAMAR, -34.0, -58.0);
        Organizacion in = persistImportada("in-info", EstadoOrganizacion.INACTIVA, -34.0, -58.0);
        var req = new org.example.organizacion.dto.ActualizarInfoPublicaRequest();
        req.setAceptaDonaciones(true);
        req.setDonacionDirectaUrl("https://example.org/donar");

        for (Organizacion o : List.of(sr, in)) {
            assertThatThrownBy(() -> organizacionService.actualizarInfoPublica(o.getId(), req))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
            assertThatThrownBy(() -> organizacionService.aprobarInfoPublica(o.getId()))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        }
        Organizacion reloaded = entityManager.find(Organizacion.class, sr.getId());
        assertThat(reloaded.getAceptaDonaciones()).isNotEqualTo(true);
        assertThat(reloaded.getDonacionDirectaUrl()).isNull();
    }

    @Test
    void findBySlugAuthenticatedServesSinReclamarToNonOwnersButNotInactiva() {
        Organizacion sr = persistImportada("sr-auth", EstadoOrganizacion.SIN_RECLAMAR, -34.0, -58.0);
        Organizacion in = persistImportada("in-auth", EstadoOrganizacion.INACTIVA, -34.0, -58.0);

        assertThat(organizacionService.findBySlug(sr.getSlug(), 999L, "ROLE_DONANTE").getEstado())
                .isEqualTo(EstadoOrganizacion.SIN_RECLAMAR);
        assertThatThrownBy(() -> organizacionService.findBySlug(in.getSlug(), 999L, "ROLE_DONANTE"))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
    }
}
