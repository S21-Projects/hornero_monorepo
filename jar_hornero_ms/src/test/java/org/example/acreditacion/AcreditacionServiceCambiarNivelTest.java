package org.example.acreditacion;

import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEventoOrganizacion;
import org.example.domain.TipoEvidencia;
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

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * AD-9: raising a level is gated on requisito completeness (every requisito demanded by the
 * destination level, and levels below it, has non-expired {@code APROBADA} evidencia). Lowering
 * only requires a non-blank reason; expiry never demotes.
 */
@DataJpaTest
@Import(AcreditacionService.class)
@RecordApplicationEvents
class AcreditacionServiceCambiarNivelTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private AcreditacionService acreditacionService;

    @Autowired
    private OrganizacionEventoRepository eventoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private ApplicationEvents events;

    private Organizacion organizacion;
    private Administrador administrador;

    private static final List<RequisitoAcreditacion> N1_REQUISITOS = List.of(
            RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO,
            RequisitoAcreditacion.NO_DISCRIMINACION,
            RequisitoAcreditacion.SEDE_INSCRIPTA_INDIVIDUALMENTE);

    @BeforeEach
    void setUp() {
        administrador = usuarioRepository.save(new Administrador(null, "Admin", "admin@test.com", "x", true));

        organizacion = new Organizacion();
        organizacion.setNombre("Comedor Nivel");
        organizacion.setSlug("comedor-nivel-" + System.nanoTime());
        organizacion.setEstado(EstadoOrganizacion.PENDIENTE);
        organizacion.setNivel(NivelAcreditacion.N0);
        organizacion = entityManager.persistFlushFind(organizacion);
    }

    private void aprobarTodos(List<RequisitoAcreditacion> requisitos, LocalDate validoHasta) {
        for (RequisitoAcreditacion requisito : requisitos) {
            var evidencia = acreditacionService.cargarEvidencia(organizacion, requisito, TipoEvidencia.DECLARACION,
                    "declaración", LocalDate.now(), validoHasta, administrador.getId());
            acreditacionService.aprobarEvidencia(evidencia.getId(), administrador.getId());
        }
    }

    @Test
    void raisingWithAllRequisitosApprovedAndNotExpiredSucceeds() {
        aprobarTodos(N1_REQUISITOS, null);

        acreditacionService.cambiarNivel(organizacion.getId(), NivelAcreditacion.N1, "cumple todo", administrador.getId());

        Organizacion reloaded = entityManager.find(Organizacion.class, organizacion.getId());
        assertThat(reloaded.getNivel()).isEqualTo(NivelAcreditacion.N1);

        List<OrganizacionEvento> eventos =
                eventoRepository.findByOrganizacion_IdAndTipoIn(organizacion.getId(), List.of(TipoEventoOrganizacion.NIVEL_ELEVADO));
        assertThat(eventos).hasSize(1);
    }

    @Test
    void raisingWithAPendingRequisitoIsRejectedWithoutChangingNivelOrAppendingAnEvent() {
        // Only two of the three N1 requisitos approved; SEDE_INSCRIPTA_INDIVIDUALMENTE stays PENDIENTE.
        var evidencia = acreditacionService.cargarEvidencia(organizacion,
                RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO, TipoEvidencia.DECLARACION, "d", LocalDate.now(),
                null, administrador.getId());
        acreditacionService.aprobarEvidencia(evidencia.getId(), administrador.getId());
        var evidencia2 = acreditacionService.cargarEvidencia(organizacion,
                RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.DECLARACION, "d", LocalDate.now(),
                null, administrador.getId());
        acreditacionService.aprobarEvidencia(evidencia2.getId(), administrador.getId());
        acreditacionService.cargarEvidencia(organizacion,
                RequisitoAcreditacion.SEDE_INSCRIPTA_INDIVIDUALMENTE, TipoEvidencia.DECLARACION, "d", LocalDate.now(),
                null, administrador.getId());

        assertThatThrownBy(() -> acreditacionService.cambiarNivel(
                organizacion.getId(), NivelAcreditacion.N1, "intento", administrador.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");

        Organizacion reloaded = entityManager.find(Organizacion.class, organizacion.getId());
        assertThat(reloaded.getNivel()).isEqualTo(NivelAcreditacion.N0);
        assertThat(eventoRepository.findByOrganizacion_IdAndTipoIn(
                organizacion.getId(), List.of(TipoEventoOrganizacion.NIVEL_ELEVADO))).isEmpty();
    }

    @Test
    void raisingWithAnApprovedButExpiredRequisitoIsRejected() {
        aprobarTodos(N1_REQUISITOS.subList(0, 2), null);
        var evidenciaVencida = acreditacionService.cargarEvidencia(organizacion,
                RequisitoAcreditacion.SEDE_INSCRIPTA_INDIVIDUALMENTE, TipoEvidencia.DECLARACION, "d",
                LocalDate.now().minusDays(30), LocalDate.now().minusDays(1), administrador.getId());
        acreditacionService.aprobarEvidencia(evidenciaVencida.getId(), administrador.getId());

        assertThatThrownBy(() -> acreditacionService.cambiarNivel(
                organizacion.getId(), NivelAcreditacion.N1, "intento", administrador.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
    }

    // --- N13: notification events ---

    @Test
    void raising_publishesNivelAcreditacionCambiadoWithTheMotivo() {
        aprobarTodos(N1_REQUISITOS, null);

        acreditacionService.cambiarNivel(organizacion.getId(), NivelAcreditacion.N1, "cumple todo", administrador.getId());

        assertThat(events.stream(NotificacionEvento.class)).containsExactly(
                new NotificacionEvento.NivelAcreditacionCambiado(organizacion.getId(), NivelAcreditacion.N0,
                        NivelAcreditacion.N1, "cumple todo"));
    }

    @Test
    void lowering_publishesNivelAcreditacionCambiado() {
        aprobarTodos(N1_REQUISITOS, null);
        acreditacionService.cambiarNivel(organizacion.getId(), NivelAcreditacion.N1, "sube", administrador.getId());
        events.clear();

        acreditacionService.cambiarNivel(organizacion.getId(), NivelAcreditacion.N0, "documentación vencida", administrador.getId());

        assertThat(events.stream(NotificacionEvento.class)).containsExactly(
                new NotificacionEvento.NivelAcreditacionCambiado(organizacion.getId(), NivelAcreditacion.N1,
                        NivelAcreditacion.N0, "documentación vencida"));
    }

    @Test
    void rejectedChange_publishesNothing() {
        assertThatThrownBy(() -> acreditacionService.cambiarNivel(
                organizacion.getId(), NivelAcreditacion.N1, "intento", administrador.getId()))
                .isInstanceOf(ResponseStatusException.class);

        assertThat(events.stream(NotificacionEvento.class)).isEmpty();
    }

    @Test
    void legacyValidation_doesNotPublishALevelEvent_theOrganizationEventCoversIt() {
        acreditacionService.aplicarTransicionLegacy(organizacion, NivelAcreditacion.N1, administrador,
                "Validación administrativa", TipoEventoOrganizacion.NIVEL_ELEVADO);

        assertThat(events.stream(NotificacionEvento.class)).isEmpty();
    }

    @Test
    void loweringWithBlankMotivoIsRejected() {
        aprobarTodos(N1_REQUISITOS, null);
        acreditacionService.cambiarNivel(organizacion.getId(), NivelAcreditacion.N1, "sube", administrador.getId());

        assertThatThrownBy(() -> acreditacionService.cambiarNivel(
                organizacion.getId(), NivelAcreditacion.N0, "  ", administrador.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void loweringWithNonBlankMotivoSucceedsAndAppendsNivelReducido() {
        aprobarTodos(N1_REQUISITOS, null);
        acreditacionService.cambiarNivel(organizacion.getId(), NivelAcreditacion.N1, "sube", administrador.getId());

        acreditacionService.cambiarNivel(organizacion.getId(), NivelAcreditacion.N0, "evidencia fraudulenta", administrador.getId());

        Organizacion reloaded = entityManager.find(Organizacion.class, organizacion.getId());
        assertThat(reloaded.getNivel()).isEqualTo(NivelAcreditacion.N0);

        List<OrganizacionEvento> eventos = eventoRepository.findByOrganizacion_IdAndTipoIn(
                organizacion.getId(), List.of(TipoEventoOrganizacion.NIVEL_REDUCIDO));
        assertThat(eventos).hasSize(1);
        assertThat(eventos.get(0).getMotivo()).isEqualTo("evidencia fraudulenta");
    }
}
