package org.example.reclamo;

import org.example.acreditacion.AcreditacionService;
import org.example.auth.VerificacionService;
import org.example.domain.EstadoReporte;
import org.example.domain.MotivoReporte;
import org.example.domain.ReporteOrganizacion;
import org.example.domain.ReporteOrganizacionRepository;
import org.example.reporte.ReporteCierre;
import org.example.user.Usuario;
import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.EstadoReclamo;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.ReclamoOrganizacion;
import org.example.domain.ReclamoOrganizacionRepository;
import org.example.domain.RolReclamo;
import org.example.domain.TipoEventoOrganizacion;
import org.example.organizacion.OrganizacionService;
import org.example.reclamo.dto.CrearReclamoRequest;
import org.example.reclamo.dto.ReclamoResponse;
import org.example.user.Administrador;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;

/** Claim-flow rules against real repositories (H2); only the activity log is mocked. */
@DataJpaTest
@Import({ReclamoService.class, OrganizacionService.class, AcreditacionService.class, VerificacionService.class,
        ReporteCierre.class, LimitesReclamo.class})
@MockBean(ActividadService.class)
class ReclamoServiceTest {

    @Autowired private TestEntityManager em;
    @Autowired private ReclamoService reclamoService;
    @Autowired private ReclamoOrganizacionRepository reclamoRepository;
    @Autowired private OrganizacionEventoRepository eventoRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private ActividadService actividadService;
    @Autowired private ReporteOrganizacionRepository reporteRepository;

    private Administrador admin;
    private Referente ana;
    private Referente beto;

    @BeforeEach
    void setUp() {
        admin = usuarioRepository.save(verificado(new Administrador(null, "Admin", "admin@test.com", "x", true)));
        ana = usuarioRepository.save(verificado(new Referente(null, "Ana", "ana@test.com", "x", true)));
        beto = usuarioRepository.save(verificado(new Referente(null, "Beto", "beto@test.com", "x", true)));
    }

    private static <U extends Usuario> U verificado(U u) {
        u.setEmailVerificado(true);
        return u;
    }

    private Organizacion org(EstadoOrganizacion estado, Referente referente) {
        Organizacion o = new Organizacion();
        o.setNombre("Comedor " + System.nanoTime());
        o.setSlug("comedor-" + System.nanoTime());
        o.setEstado(estado);
        o.setNivel(NivelAcreditacion.N0);
        o.setValidada(false);
        o.setReferente(referente);
        return em.persistFlushFind(o);
    }

    private static String key(Organizacion o, Referente r, String file) {
        return "reclamo-evidencia/" + o.getId() + "/" + r.getId() + "/" + file;
    }

    private CrearReclamoRequest request(Organizacion o, Referente r) {
        return new CrearReclamoRequest(o.getId(), RolReclamo.RESPONSABLE, "+54 351 555 1234", "Soy la coordinadora",
                List.of(key(o, r, "1.jpg")));
    }

    private static void assertStatus(Runnable action, HttpStatus status) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(status));
    }

    // --- crear ---

    @Test
    void crear_onSinReclamar_persistsPendingClaimAndLogsActivity() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);

        ReclamoResponse r = reclamoService.crear(request(o, ana), ana.getId());

        assertThat(r.estado()).isEqualTo(EstadoReclamo.PENDIENTE);
        assertThat(r.solicitanteId()).isEqualTo(ana.getId());
        assertThat(r.evidenciaKeys()).containsExactly(key(o, ana, "1.jpg"));
        ArgumentCaptor<ActividadService.Registro> captor = ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService).registrar(captor.capture());
        assertThat(captor.getValue().accion()).isEqualTo(TipoActividad.RECLAMO_CREADO);
        assertThat(captor.getValue().detalle()).doesNotContain("555");
        // The organizacion is untouched until an admin approves.
        assertThat(em.find(Organizacion.class, o.getId()).getEstado()).isEqualTo(EstadoOrganizacion.SIN_RECLAMAR);
    }

    @Test
    void crear_byNonReferente_is403() {
        Donante donante = usuarioRepository.save(verificado(new Donante(null, "Don", "don@test.com", "x", true)));
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);

        assertStatus(() -> reclamoService.crear(request(o, ana), donante.getId()), HttpStatus.FORBIDDEN);
    }

    @Test
    void crear_onUnknownOrganizacion_is404() {
        assertStatus(() -> reclamoService.crear(new CrearReclamoRequest(999_999L, RolReclamo.VOLUNTARIO,
                "351555123", null, List.of("x")), ana.getId()), HttpStatus.NOT_FOUND);
    }

    @Test
    void crear_onAnyEstadoButSinReclamar_is409() {
        for (EstadoOrganizacion estado : List.of(EstadoOrganizacion.PENDIENTE, EstadoOrganizacion.APROBADA,
                EstadoOrganizacion.RECHAZADA, EstadoOrganizacion.INACTIVA)) {
            Organizacion o = org(estado, null);
            assertStatus(() -> reclamoService.crear(request(o, ana), ana.getId()), HttpStatus.CONFLICT);
        }
    }

    @Test
    void crear_twiceWhilePending_is409_butAnotherReferenteMayAlsoClaim() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        reclamoService.crear(request(o, ana), ana.getId());

        assertStatus(() -> reclamoService.crear(request(o, ana), ana.getId()), HttpStatus.CONFLICT);
        reclamoService.crear(request(o, beto), beto.getId());
        assertThat(reclamoRepository.findByOrganizacion_IdAndEstado(o.getId(), EstadoReclamo.PENDIENTE)).hasSize(2);
    }

    @Test
    void crear_whenReferenteAlreadyHasThreeOrganizaciones_is409_butRejectedOnesDoNotCount() {
        org(EstadoOrganizacion.APROBADA, ana);
        org(EstadoOrganizacion.PENDIENTE, ana);
        org(EstadoOrganizacion.RECHAZADA, ana);
        Organizacion libre = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        reclamoService.crear(request(libre, ana), ana.getId()); // 2 counted: room for one more

        org(EstadoOrganizacion.APROBADA, ana); // now 3 counted
        Organizacion otra = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        assertStatus(() -> reclamoService.crear(request(otra, ana), ana.getId()), HttpStatus.CONFLICT);
    }

    @Test
    void crear_rejectsEvidenceKeysOfAnotherOrganizacionOrAnotherClaimantOrDuplicates() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Organizacion otra = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        for (String bad : List.of(key(otra, ana, "1.jpg"), key(o, beto, "1.jpg"), "org-evidencia/" + o.getId() + "/1.jpg",
                "reclamo-evidencia/" + o.getId() + "/" + ana.getId() + "/../x.jpg")) {
            assertStatus(() -> reclamoService.crear(new CrearReclamoRequest(o.getId(), RolReclamo.VOLUNTARIO,
                    "351555123", null, List.of(bad)), ana.getId()), HttpStatus.BAD_REQUEST);
        }
        String k = key(o, ana, "1.jpg");
        assertStatus(() -> reclamoService.crear(new CrearReclamoRequest(o.getId(), RolReclamo.VOLUNTARIO,
                "351555123", null, List.of(k, k)), ana.getId()), HttpStatus.BAD_REQUEST);
    }

    @Test
    void listarMios_returnsOnlyTheCallersClaims() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        reclamoService.crear(request(o, ana), ana.getId());
        reclamoService.crear(request(o, beto), beto.getId());

        assertThat(reclamoService.listarMios(ana.getId())).extracting(ReclamoResponse::solicitanteId)
                .containsExactly(ana.getId());
    }

    // --- spam caps ---

    private void sembrarReclamos(Referente quien, EstadoReclamo estado, Instant creadoEn, int cantidad) {
        for (int i = 0; i < cantidad; i++) {
            ReclamoOrganizacion r = new ReclamoOrganizacion();
            r.setOrganizacion(org(EstadoOrganizacion.SIN_RECLAMAR, null));
            r.setReferente(quien);
            r.setRol(RolReclamo.RESPONSABLE);
            r.setTelefono("351 555 1234");
            r.setEstado(estado);
            r.setCreadoEn(creadoEn);
            em.persist(r);
        }
        em.flush();
    }

    private static void assertRazon(Runnable action, HttpStatus status, String razon) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(status);
                    assertThat(e.getReason()).isEqualTo(razon);
                });
    }

    @Test
    void crearAndVerificarReclamable_withFivePendingClaims_are409LimiteReclamosPendientes_andNothingIsSaved() {
        sembrarReclamos(ana, EstadoReclamo.PENDIENTE, Instant.now(), 5);
        Organizacion nueva = org(EstadoOrganizacion.SIN_RECLAMAR, null);

        assertRazon(() -> reclamoService.crear(request(nueva, ana), ana.getId()),
                HttpStatus.CONFLICT, ReclamoService.LIMITE_RECLAMOS_PENDIENTES);
        assertRazon(() -> reclamoService.verificarReclamable(nueva.getId(), ana.getId()),
                HttpStatus.CONFLICT, ReclamoService.LIMITE_RECLAMOS_PENDIENTES);
        assertThat(reclamoRepository.count()).isEqualTo(5);
    }

    @Test
    void crear_withFiveClaimsInTheWindowNoneOfThemPending_is429DemasiadosReclamos_butThePreflightPasses() {
        sembrarReclamos(ana, EstadoReclamo.RECHAZADO, Instant.now().minus(Duration.ofHours(1)), 5);
        Organizacion nueva = org(EstadoOrganizacion.SIN_RECLAMAR, null);

        reclamoService.verificarReclamable(nueva.getId(), ana.getId()); // the window is not part of the preflight
        assertRazon(() -> reclamoService.crear(request(nueva, ana), ana.getId()),
                HttpStatus.TOO_MANY_REQUESTS, ReclamoService.DEMASIADOS_RECLAMOS);
        assertThat(reclamoRepository.count()).isEqualTo(5);
    }

    @Test
    void crear_withFiveClaimsOlderThanTheWindow_succeeds() {
        sembrarReclamos(ana, EstadoReclamo.RECHAZADO, Instant.now().minus(Duration.ofHours(25)), 5);
        Organizacion nueva = org(EstadoOrganizacion.SIN_RECLAMAR, null);

        ReclamoResponse r = reclamoService.crear(request(nueva, ana), ana.getId());

        assertThat(r.estado()).isEqualTo(EstadoReclamo.PENDIENTE);
        assertThat(reclamoRepository.count()).isEqualTo(6);
    }

    // --- aprobar ---

    @Test
    void aprobar_assignsReferente_keepsN0_movesToPendiente_andWritesEventsAndActivity() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Long id = reclamoService.crear(request(o, ana), ana.getId()).id();

        ReclamoResponse r = reclamoService.aprobar(id, admin.getId());
        em.flush();
        em.clear();

        assertThat(r.estado()).isEqualTo(EstadoReclamo.APROBADO);
        assertThat(r.resueltoPorNombre()).isEqualTo("Admin");
        Organizacion reloaded = em.find(Organizacion.class, o.getId());
        assertThat(reloaded.getReferente().getId()).isEqualTo(ana.getId());
        assertThat(reloaded.getEstado()).isEqualTo(EstadoOrganizacion.PENDIENTE);
        assertThat(reloaded.getNivel()).isEqualTo(NivelAcreditacion.N0);
        assertThat(reloaded.getValidada()).isFalse();
        assertThat(eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(o.getId()))
                .extracting(OrganizacionEvento::getTipo)
                .containsExactlyInAnyOrder(TipoEventoOrganizacion.REFERENTE_REASIGNADO,
                        TipoEventoOrganizacion.RECLAMO_APROBADO);
        ArgumentCaptor<ActividadService.Registro> captor = ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService, atLeastOnce()).registrar(captor.capture());
        assertThat(captor.getAllValues()).extracting(ActividadService.Registro::accion)
                .contains(TipoActividad.RECLAMO_APROBADO, TipoActividad.ORGANIZACION_REFERENTE_REASIGNADO);
    }

    @Test
    void aprobar_autoRejectsTheOtherPendingClaimsOnTheSameOrganizacion() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Long ganador = reclamoService.crear(request(o, ana), ana.getId()).id();
        Long perdedor = reclamoService.crear(request(o, beto), beto.getId()).id();
        Organizacion otraOrg = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Long ajeno = reclamoService.crear(request(otraOrg, beto), beto.getId()).id();

        reclamoService.aprobar(ganador, admin.getId());

        ReclamoOrganizacion lost = reclamoRepository.findById(perdedor).orElseThrow();
        assertThat(lost.getEstado()).isEqualTo(EstadoReclamo.RECHAZADO);
        assertThat(lost.getMotivoRechazo()).isEqualTo(ReclamoService.MOTIVO_OTRO_RECLAMO_APROBADO);
        assertThat(lost.getResueltoPor().getId()).isEqualTo(admin.getId());
        assertThat(reclamoRepository.findById(ajeno).orElseThrow().getEstado()).isEqualTo(EstadoReclamo.PENDIENTE);
        assertThat(eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(o.getId()))
                .extracting(OrganizacionEvento::getTipo).contains(TipoEventoOrganizacion.RECLAMO_RECHAZADO);
    }

    @Test
    void aprobar_byNonAdmin_is403_andChangesNothing() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Long id = reclamoService.crear(request(o, ana), ana.getId()).id();

        assertStatus(() -> reclamoService.aprobar(id, ana.getId()), HttpStatus.FORBIDDEN);
        assertThat(reclamoRepository.findById(id).orElseThrow().getEstado()).isEqualTo(EstadoReclamo.PENDIENTE);
    }

    @Test
    void aprobar_twice_secondIs409() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Long id = reclamoService.crear(request(o, ana), ana.getId()).id();
        reclamoService.aprobar(id, admin.getId());

        assertStatus(() -> reclamoService.aprobar(id, admin.getId()), HttpStatus.CONFLICT);
    }

    @Test
    void aprobar_anAutoRejectedClaim_is409_soTwoApprovalsOnTheSameOrganizacionCannotBothSucceed() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Long primero = reclamoService.crear(request(o, ana), ana.getId()).id();
        Long segundo = reclamoService.crear(request(o, beto), beto.getId()).id();
        reclamoService.aprobar(primero, admin.getId());

        assertStatus(() -> reclamoService.aprobar(segundo, admin.getId()), HttpStatus.CONFLICT);
        assertThat(em.find(Organizacion.class, o.getId()).getReferente().getId()).isEqualTo(ana.getId());
    }

    @Test
    void aprobar_whenOrganizacionIsNoLongerSinReclamar_is409() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Long id = reclamoService.crear(request(o, ana), ana.getId()).id();
        o.setEstado(EstadoOrganizacion.INACTIVA); // e.g. reported closed meanwhile
        em.persistAndFlush(o);

        assertStatus(() -> reclamoService.aprobar(id, admin.getId()), HttpStatus.CONFLICT);
        assertThat(em.find(Organizacion.class, o.getId()).getReferente()).isNull();
        assertThat(reclamoRepository.findById(id).orElseThrow().getEstado()).isEqualTo(EstadoReclamo.PENDIENTE);
    }

    @Test
    void aprobar_rechecksTheCapAtApprovalTime() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Long id = reclamoService.crear(request(o, ana), ana.getId()).id();
        // Between submit and approval the referente was given three organizaciones elsewhere.
        org(EstadoOrganizacion.APROBADA, ana);
        org(EstadoOrganizacion.APROBADA, ana);
        org(EstadoOrganizacion.PENDIENTE, ana);

        assertStatus(() -> reclamoService.aprobar(id, admin.getId()), HttpStatus.CONFLICT);
        assertThat(em.find(Organizacion.class, o.getId()).getReferente()).isNull();
    }

    // --- rechazar ---

    @Test
    void rechazar_storesMotivoAdminEventAndActivity_andLeavesOrganizacionSinReclamar() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Long id = reclamoService.crear(request(o, ana), ana.getId()).id();

        ReclamoResponse r = reclamoService.rechazar(id, "  No pudimos verificar la evidencia  ", admin.getId());

        assertThat(r.estado()).isEqualTo(EstadoReclamo.RECHAZADO);
        assertThat(r.motivoRechazo()).isEqualTo("No pudimos verificar la evidencia");
        assertThat(em.find(Organizacion.class, o.getId()).getEstado()).isEqualTo(EstadoOrganizacion.SIN_RECLAMAR);
        assertThat(eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(o.getId()))
                .extracting(OrganizacionEvento::getTipo).containsExactly(TipoEventoOrganizacion.RECLAMO_RECHAZADO);
        ArgumentCaptor<ActividadService.Registro> captor = ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService, atLeastOnce()).registrar(captor.capture());
        assertThat(captor.getAllValues()).anySatisfy(reg -> {
            assertThat(reg.accion()).isEqualTo(TipoActividad.RECLAMO_RECHAZADO);
            assertThat(reg.motivo()).isEqualTo("No pudimos verificar la evidencia");
        });
    }

    @Test
    void rechazar_withBlankMotivo_is400() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Long id = reclamoService.crear(request(o, ana), ana.getId()).id();

        assertStatus(() -> reclamoService.rechazar(id, "   ", admin.getId()), HttpStatus.BAD_REQUEST);
        assertStatus(() -> reclamoService.rechazar(id, null, admin.getId()), HttpStatus.BAD_REQUEST);
    }

    @Test
    void rechazar_byNonAdmin_is403_andAnAlreadyResolvedClaimIs409() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Long id = reclamoService.crear(request(o, ana), ana.getId()).id();

        assertStatus(() -> reclamoService.rechazar(id, "x", ana.getId()), HttpStatus.FORBIDDEN);
        reclamoService.rechazar(id, "x", admin.getId());
        assertStatus(() -> reclamoService.rechazar(id, "y", admin.getId()), HttpStatus.CONFLICT);
        assertStatus(() -> reclamoService.aprobar(id, admin.getId()), HttpStatus.CONFLICT);
    }

    @Test
    void rechazar_unknownClaim_is404() {
        assertStatus(() -> reclamoService.rechazar(999_999L, "x", admin.getId()), HttpStatus.NOT_FOUND);
    }

    // --- reads ---

    @Test
    void listarPendientes_listsOnlyPendingOldestFirst() {
        Organizacion o1 = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Organizacion o2 = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Long a = reclamoService.crear(request(o1, ana), ana.getId()).id();
        Long b = reclamoService.crear(request(o2, ana), ana.getId()).id();
        reclamoService.rechazar(a, "no", admin.getId());

        var page = reclamoService.listarPendientes(org.springframework.data.domain.PageRequest.of(0, 10,
                org.springframework.data.domain.Sort.by("creadoEn")));

        assertThat(page.getContent()).extracting(ReclamoResponse::id).containsExactly(b);
    }

    @Test
    void detalle_adminSeesLoadOutOfCap_claimantSeesOwn_otherReferenteIs403() {
        org(EstadoOrganizacion.APROBADA, ana);
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Long id = reclamoService.crear(request(o, ana), ana.getId()).id();

        ReclamoResponse admins = reclamoService.detalle(id, admin.getId(), true);
        assertThat(admins.organizacionesACargo()).isEqualTo(1);
        assertThat(admins.capOrganizaciones()).isEqualTo(3);
        assertThat(reclamoService.detalle(id, ana.getId(), false).organizacionesACargo()).isNull();
        assertStatus(() -> reclamoService.detalle(id, beto.getId(), false), HttpStatus.FORBIDDEN);
        assertStatus(() -> reclamoService.detalle(999_999L, admin.getId(), true), HttpStatus.NOT_FOUND);
    }

    @Test
    void verificarArchivo_requiresBoundKeyAndAdminOrOwner() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        reclamoService.crear(request(o, ana), ana.getId());
        String k = key(o, ana, "1.jpg");

        reclamoService.verificarArchivo(o.getId(), ana.getId(), k, ana.getId(), false);
        reclamoService.verificarArchivo(o.getId(), ana.getId(), k, admin.getId(), true);
        assertStatus(() -> reclamoService.verificarArchivo(o.getId(), ana.getId(), k, beto.getId(), false),
                HttpStatus.FORBIDDEN);
        assertStatus(() -> reclamoService.verificarArchivo(o.getId(), ana.getId(), key(o, ana, "2.jpg"),
                ana.getId(), false), HttpStatus.NOT_FOUND);
        assertStatus(() -> reclamoService.verificarArchivo(o.getId(), ana.getId(), "../x", ana.getId(), false),
                HttpStatus.BAD_REQUEST);
        assertStatus(() -> reclamoService.verificarArchivo(o.getId(), beto.getId(), k, admin.getId(), true),
                HttpStatus.BAD_REQUEST);
    }

    // --- verified-account gate ---

    @Test
    void crear_andDisponibilidad_byAnUnverifiedReferente_are403EmailNoVerificado() {
        Referente sinVerificar = usuarioRepository.save(new Referente(null, "Cris", "cris@test.com", "x", true));
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);

        assertThatThrownBy(() -> reclamoService.crear(request(o, sinVerificar), sinVerificar.getId()))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(e.getReason()).isEqualTo("EMAIL_NO_VERIFICADO");
                });
        assertStatus(() -> reclamoService.verificarReclamable(o.getId(), sinVerificar.getId()), HttpStatus.FORBIDDEN);
        assertThat(reclamoRepository.count()).isZero();
    }

    // --- cross-flow closure ---

    @Test
    void aprobar_autoDiscardsThePendingReportsOnTheOrganizacion_withTheSameEventsAndActivityAsAManualDiscard() {
        Organizacion o = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Organizacion otra = org(EstadoOrganizacion.SIN_RECLAMAR, null);
        Long reclamo = reclamoService.crear(request(o, ana), ana.getId()).id();
        ReporteOrganizacion r1 = reporte(o, beto);
        ReporteOrganizacion r2 = reporte(o, ana);
        ReporteOrganizacion ajeno = reporte(otra, beto);

        reclamoService.aprobar(reclamo, admin.getId());
        em.flush();
        em.clear();

        for (Long id : List.of(r1.getId(), r2.getId())) {
            ReporteOrganizacion r = reporteRepository.findById(id).orElseThrow();
            assertThat(r.getEstado()).isEqualTo(EstadoReporte.DESCARTADO);
            assertThat(r.getNotaResolucion()).isEqualTo("La organización fue reclamada");
            assertThat(r.getResueltoPor().getId()).isEqualTo(admin.getId());
        }
        assertThat(reporteRepository.findById(ajeno.getId()).orElseThrow().getEstado()).isEqualTo(EstadoReporte.PENDIENTE);
        assertThat(eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(o.getId()))
                .extracting(OrganizacionEvento::getTipo)
                .filteredOn(t -> t == TipoEventoOrganizacion.REPORTE_DESCARTADO).hasSize(2);
        ArgumentCaptor<ActividadService.Registro> captor = ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService, atLeastOnce()).registrar(captor.capture());
        assertThat(captor.getAllValues()).filteredOn(g -> g.accion() == TipoActividad.REPORTE_DESCARTADO)
                .hasSize(2).allSatisfy(g -> assertThat(g.motivo()).isEqualTo("La organización fue reclamada"));
    }

    private ReporteOrganizacion reporte(Organizacion o, Referente quien) {
        ReporteOrganizacion r = new ReporteOrganizacion();
        r.setOrganizacion(o);
        r.setReportante(quien);
        r.setMotivo(MotivoReporte.INACTIVO);
        return reporteRepository.saveAndFlush(r);
    }
}
