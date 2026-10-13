package org.example.reporte;

import org.example.acreditacion.AcreditacionService;
import org.example.auth.VerificacionService;
import org.example.domain.EstadoReclamo;
import org.example.domain.ReclamoOrganizacion;
import org.example.domain.ReclamoOrganizacionRepository;
import org.example.domain.RolReclamo;
import org.example.organizacion.OrganizacionService;
import org.example.reclamo.LimitesReclamo;
import org.example.reclamo.ReclamoService;
import org.example.user.Usuario;
import org.springframework.web.server.ResponseStatusException;
import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.EstadoReporte;
import org.example.domain.MotivoReporte;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrigenOrganizacion;
import org.example.domain.ReporteOrganizacion;
import org.example.domain.ReporteOrganizacionRepository;
import org.example.domain.TipoEventoOrganizacion;
import org.example.reporte.dto.CrearReporteRequest;
import org.example.reporte.dto.OrganizacionCercanaResponse;
import org.example.reporte.dto.ReporteResponse;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;

/** Report-flow rules against real repositories (H2); only the activity log is mocked. */
@DataJpaTest
@Import({ReporteService.class, AcreditacionService.class, VerificacionService.class, ReporteCierre.class,
        ReclamoService.class, OrganizacionService.class, LimitesReclamo.class, LimitesReporte.class})
@MockBean(ActividadService.class)
class ReporteServiceTest {

    private static final double LAT = -31.4200;
    private static final double LNG = -64.1900;

    @Autowired private TestEntityManager em;
    @Autowired private ReporteService reporteService;
    @Autowired private ReporteOrganizacionRepository reporteRepository;
    @Autowired private OrganizacionEventoRepository eventoRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private ActividadService actividadService;
    @Autowired private ReclamoOrganizacionRepository reclamoRepository;

    private Administrador admin;
    private Donante dona;
    private Referente ana;

    @BeforeEach
    void setUp() {
        admin = usuarioRepository.save(verificado(new Administrador(null, "Admin", "admin@test.com", "x", true)));
        dona = usuarioRepository.save(verificado(new Donante(null, "Dona", "dona@test.com", "x", true)));
        ana = usuarioRepository.save(verificado(new Referente(null, "Ana", "ana@test.com", "x", true)));
    }

    private static <U extends Usuario> U verificado(U u) {
        u.setEmailVerificado(true);
        return u;
    }

    private Organizacion org(EstadoOrganizacion estado, OrigenOrganizacion origen, double lat, double lng) {
        Organizacion o = new Organizacion();
        o.setNombre("Comedor " + System.nanoTime());
        o.setSlug("comedor-" + System.nanoTime());
        o.setEstado(estado);
        o.setOrigen(origen);
        o.setNivel(NivelAcreditacion.N0);
        o.setValidada(false);
        o.setLatitud(lat);
        o.setLongitud(lng);
        return em.persistFlushFind(o);
    }

    private Organizacion sinReclamar() {
        return org(EstadoOrganizacion.SIN_RECLAMAR, OrigenOrganizacion.RENACOM, LAT, LNG);
    }

    private Organizacion plataforma(double dLat) {
        return org(EstadoOrganizacion.APROBADA, OrigenOrganizacion.PLATAFORMA, LAT + dLat, LNG);
    }

    private static CrearReporteRequest inactivo(Organizacion o) {
        return new CrearReporteRequest(o.getId(), MotivoReporte.INACTIVO, null, "  Cerró en marzo  ");
    }

    private static void assertStatus(Runnable action, HttpStatus status) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(status));
    }

    // --- crear ---

    @Test
    void crear_onSinReclamar_persistsPendingReportForAnyRole_andLogsActivityWithoutDetalle() {
        Organizacion o = sinReclamar();

        ReporteResponse r = reporteService.crear(inactivo(o), dona.getId());
        ReporteResponse deAna = reporteService.crear(inactivo(o), ana.getId());

        assertThat(r.estado()).isEqualTo(EstadoReporte.PENDIENTE);
        assertThat(r.reportanteId()).isEqualTo(dona.getId());
        assertThat(r.detalle()).isEqualTo("Cerró en marzo");
        assertThat(deAna.reportanteId()).isEqualTo(ana.getId());
        ArgumentCaptor<ActividadService.Registro> captor = ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService, atLeastOnce()).registrar(captor.capture());
        assertThat(captor.getAllValues()).allSatisfy(reg -> {
            assertThat(reg.accion()).isEqualTo(TipoActividad.REPORTE_CREADO);
            assertThat(reg.detalle()).doesNotContain("marzo");
        });
        // The organizacion is untouched until an admin resolves.
        assertThat(em.find(Organizacion.class, o.getId()).getEstado()).isEqualTo(EstadoOrganizacion.SIN_RECLAMAR);
    }

    @Test
    void crear_onUnknownOrganizacion_is404() {
        assertStatus(() -> reporteService.crear(
                new CrearReporteRequest(999_999L, MotivoReporte.OTRO, null, null), dona.getId()), HttpStatus.NOT_FOUND);
    }

    @Test
    void crear_onAnyEstadoButSinReclamar_is409() {
        for (EstadoOrganizacion estado : List.of(EstadoOrganizacion.PENDIENTE, EstadoOrganizacion.APROBADA,
                EstadoOrganizacion.RECHAZADA, EstadoOrganizacion.INACTIVA)) {
            Organizacion o = org(estado, OrigenOrganizacion.PLATAFORMA, LAT, LNG);
            assertStatus(() -> reporteService.crear(inactivo(o), dona.getId()), HttpStatus.CONFLICT);
        }
    }

    @Test
    void crear_twiceWhilePending_is409_butAfterResolutionTheUserMayReportAgain() {
        Organizacion o = sinReclamar();
        Long id = reporteService.crear(inactivo(o), dona.getId()).id();

        assertStatus(() -> reporteService.crear(inactivo(o), dona.getId()), HttpStatus.CONFLICT);

        reporteService.descartar(id, "No se pudo verificar", admin.getId());
        assertThat(reporteService.crear(inactivo(o), dona.getId()).estado()).isEqualTo(EstadoReporte.PENDIENTE);
    }

    @Test
    void crear_duplicado_requiresAValidatedPlatformOrganizacionOtherThanTheReportedOne() {
        Organizacion o = sinReclamar();
        Organizacion buena = plataforma(0.001);

        ReporteResponse r = reporteService.crear(
                new CrearReporteRequest(o.getId(), MotivoReporte.DUPLICADO, buena.getId(), null), dona.getId());
        assertThat(r.organizacionDuplicadaId()).isEqualTo(buena.getId());
        assertThat(r.organizacionDuplicadaSlug()).isEqualTo(buena.getSlug());
    }

    @Test
    void crear_duplicado_withBadReference_is400() {
        Organizacion o = sinReclamar();
        Organizacion otraImportada = sinReclamar();
        Organizacion pendiente = org(EstadoOrganizacion.PENDIENTE, OrigenOrganizacion.PLATAFORMA, LAT, LNG);

        for (Long malo : java.util.Arrays.asList(null, o.getId(), otraImportada.getId(), pendiente.getId(), 999_999L)) {
            assertStatus(() -> reporteService.crear(
                    new CrearReporteRequest(o.getId(), MotivoReporte.DUPLICADO, malo, null), dona.getId()),
                    HttpStatus.BAD_REQUEST);
        }
        assertThat(reporteRepository.count()).isZero();
    }

    @Test
    void crear_otherMotivoWithADuplicateReference_is400() {
        Organizacion o = sinReclamar();
        Organizacion buena = plataforma(0.001);

        assertStatus(() -> reporteService.crear(
                new CrearReporteRequest(o.getId(), MotivoReporte.DATOS_INCORRECTOS, buena.getId(), null), dona.getId()),
                HttpStatus.BAD_REQUEST);
    }

    // --- cercanas ---

    @Test
    void cercanas_returnsOnlyApprovedPlatformOrganizacionsWithin500m_nearestFirst() {
        Organizacion o = sinReclamar();
        Organizacion cerca = plataforma(0.002);      // ~222 m
        Organizacion mascerca = plataforma(-0.001);  // ~111 m
        plataforma(0.006);                           // ~668 m: outside
        org(EstadoOrganizacion.PENDIENTE, OrigenOrganizacion.PLATAFORMA, LAT + 0.001, LNG);  // not approved
        org(EstadoOrganizacion.SIN_RECLAMAR, OrigenOrganizacion.RENACOM, LAT + 0.001, LNG);  // imported

        List<OrganizacionCercanaResponse> r = reporteService.cercanas(o.getId());

        assertThat(r).extracting(OrganizacionCercanaResponse::id).containsExactly(mascerca.getId(), cerca.getId());
        assertThat(r.get(0).distanciaMetros()).isBetween(100, 125);
        assertThat(r.get(1).distanciaMetros()).isBetween(210, 235);
    }

    @Test
    void cercanas_onAnOrganizacionWithoutCoordinates_isEmpty_andOnNonReportableIs409() {
        Organizacion sinCoords = new Organizacion();
        sinCoords.setNombre("Sin coords");
        sinCoords.setSlug("sin-coords");
        sinCoords.setEstado(EstadoOrganizacion.SIN_RECLAMAR);
        sinCoords.setNivel(NivelAcreditacion.N0);
        sinCoords = em.persistFlushFind(sinCoords);
        assertThat(reporteService.cercanas(sinCoords.getId())).isEmpty();

        Organizacion activa = plataforma(0);
        assertStatus(() -> reporteService.cercanas(activa.getId()), HttpStatus.CONFLICT);
        assertStatus(() -> reporteService.cercanas(999_999L), HttpStatus.NOT_FOUND);
    }

    @Test
    void distanciaMetros_matchesKnownDistance() {
        // One degree of latitude is ~111.19 km on the 6,371 km sphere.
        assertThat(ReporteService.distanciaMetros(0, 0, 1, 0)).isBetween(111_100.0, 111_300.0);
        assertThat(ReporteService.distanciaMetros(LAT, LNG, LAT, LNG)).isZero();
    }

    // --- marcarInactiva ---

    @Test
    void marcarInactiva_movesOrgToInactiva_confirmsAllPendingReports_andWritesEventsAndActivity() {
        Organizacion o = sinReclamar();
        Organizacion otra = sinReclamar();
        Long primero = reporteService.crear(inactivo(o), dona.getId()).id();
        Long segundo = reporteService.crear(inactivo(o), ana.getId()).id();
        Long ajeno = reporteService.crear(inactivo(otra), dona.getId()).id();

        ReporteResponse r = reporteService.marcarInactiva(primero, admin.getId());
        em.flush();
        em.clear();

        assertThat(r.estado()).isEqualTo(EstadoReporte.CONFIRMADO);
        assertThat(r.resueltoPorNombre()).isEqualTo("Admin");
        assertThat(em.find(Organizacion.class, o.getId()).getEstado()).isEqualTo(EstadoOrganizacion.INACTIVA);
        assertThat(reporteRepository.findById(segundo).orElseThrow().getEstado()).isEqualTo(EstadoReporte.CONFIRMADO);
        assertThat(reporteRepository.findById(segundo).orElseThrow().getResueltoPor().getId()).isEqualTo(admin.getId());
        assertThat(reporteRepository.findById(ajeno).orElseThrow().getEstado()).isEqualTo(EstadoReporte.PENDIENTE);
        assertThat(em.find(Organizacion.class, otra.getId()).getEstado()).isEqualTo(EstadoOrganizacion.SIN_RECLAMAR);
        assertThat(eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(o.getId()))
                .extracting(OrganizacionEvento::getTipo)
                .containsExactly(TipoEventoOrganizacion.REPORTE_CONFIRMADO, TipoEventoOrganizacion.REPORTE_CONFIRMADO);
        ArgumentCaptor<ActividadService.Registro> captor = ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService, atLeastOnce()).registrar(captor.capture());
        assertThat(captor.getAllValues()).extracting(ActividadService.Registro::accion)
                .contains(TipoActividad.REPORTE_CONFIRMADO);
    }

    @Test
    void marcarInactiva_byNonAdmin_is403_andChangesNothing() {
        Organizacion o = sinReclamar();
        Long id = reporteService.crear(inactivo(o), dona.getId()).id();

        assertStatus(() -> reporteService.marcarInactiva(id, ana.getId()), HttpStatus.FORBIDDEN);
        assertThat(reporteRepository.findById(id).orElseThrow().getEstado()).isEqualTo(EstadoReporte.PENDIENTE);
        assertThat(em.find(Organizacion.class, o.getId()).getEstado()).isEqualTo(EstadoOrganizacion.SIN_RECLAMAR);
    }

    @Test
    void marcarInactiva_twice_secondIs409() {
        Organizacion o = sinReclamar();
        Long id = reporteService.crear(inactivo(o), dona.getId()).id();
        reporteService.marcarInactiva(id, admin.getId());

        assertStatus(() -> reporteService.marcarInactiva(id, admin.getId()), HttpStatus.CONFLICT);
    }

    @Test
    void marcarInactiva_whenOrganizacionIsNoLongerSinReclamar_is409_andReportStaysPending() {
        Organizacion o = sinReclamar();
        Long id = reporteService.crear(inactivo(o), dona.getId()).id();
        o.setEstado(EstadoOrganizacion.PENDIENTE); // e.g. a claim was approved meanwhile
        em.persistAndFlush(o);

        assertStatus(() -> reporteService.marcarInactiva(id, admin.getId()), HttpStatus.CONFLICT);
        assertThat(reporteRepository.findById(id).orElseThrow().getEstado()).isEqualTo(EstadoReporte.PENDIENTE);
        assertThat(em.find(Organizacion.class, o.getId()).getEstado()).isEqualTo(EstadoOrganizacion.PENDIENTE);
    }

    @Test
    void marcarInactiva_unknownReport_is404() {
        assertStatus(() -> reporteService.marcarInactiva(999_999L, admin.getId()), HttpStatus.NOT_FOUND);
    }

    // --- descartar ---

    @Test
    void descartar_storesNoteAdminEventAndActivity_andLeavesOrganizacionAndOtherReportsAlone() {
        Organizacion o = sinReclamar();
        Long id = reporteService.crear(inactivo(o), dona.getId()).id();
        Long otro = reporteService.crear(inactivo(o), ana.getId()).id();

        ReporteResponse r = reporteService.descartar(id, "  Sigue funcionando  ", admin.getId());

        assertThat(r.estado()).isEqualTo(EstadoReporte.DESCARTADO);
        assertThat(r.notaResolucion()).isEqualTo("Sigue funcionando");
        assertThat(em.find(Organizacion.class, o.getId()).getEstado()).isEqualTo(EstadoOrganizacion.SIN_RECLAMAR);
        assertThat(reporteRepository.findById(otro).orElseThrow().getEstado()).isEqualTo(EstadoReporte.PENDIENTE);
        assertThat(eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(o.getId()))
                .extracting(OrganizacionEvento::getTipo).containsExactly(TipoEventoOrganizacion.REPORTE_DESCARTADO);
        ArgumentCaptor<ActividadService.Registro> captor = ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService, atLeastOnce()).registrar(captor.capture());
        assertThat(captor.getAllValues()).anySatisfy(reg -> {
            assertThat(reg.accion()).isEqualTo(TipoActividad.REPORTE_DESCARTADO);
            assertThat(reg.motivo()).isEqualTo("Sigue funcionando");
        });
    }

    @Test
    void descartar_withoutNote_is400_nonAdminIs403_andAlreadyResolvedIs409() {
        Organizacion o = sinReclamar();
        Long id = reporteService.crear(inactivo(o), dona.getId()).id();

        assertStatus(() -> reporteService.descartar(id, "  ", admin.getId()), HttpStatus.BAD_REQUEST);
        assertStatus(() -> reporteService.descartar(id, null, admin.getId()), HttpStatus.BAD_REQUEST);
        assertStatus(() -> reporteService.descartar(id, "x", dona.getId()), HttpStatus.FORBIDDEN);
        assertThat(reporteRepository.findById(id).orElseThrow().getEstado()).isEqualTo(EstadoReporte.PENDIENTE);

        reporteService.descartar(id, "x", admin.getId());
        assertStatus(() -> reporteService.descartar(id, "x", admin.getId()), HttpStatus.CONFLICT);
    }

    // --- listing ---

    @Test
    void listarPendientes_excludesResolvedReports_andDetalleExposesTheReporter() {
        Organizacion o = sinReclamar();
        Long abierto = reporteService.crear(inactivo(o), dona.getId()).id();
        Long cerrado = reporteService.crear(inactivo(o), ana.getId()).id();
        reporteService.descartar(cerrado, "no", admin.getId());

        assertThat(reporteService.listarPendientes(PageRequest.of(0, 20)).getContent())
                .extracting(ReporteResponse::id).containsExactly(abierto);
        assertThat(reporteService.detalle(abierto).reportanteEmail()).isEqualTo("dona@test.com");
        assertStatus(() -> reporteService.detalle(999_999L), HttpStatus.NOT_FOUND);
    }

    // --- spam caps, verified gate ---

    @Test
    void crear_byAnUnverifiedUser_is403EmailNoVerificado_andNothingIsSaved() {
        Donante sinVerificar = usuarioRepository.save(new Donante(null, "Sin", "sin@test.com", "x", true));
        Organizacion o = sinReclamar();

        assertThatThrownBy(() -> reporteService.crear(inactivo(o), sinVerificar.getId()))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(e.getReason()).isEqualTo("EMAIL_NO_VERIFICADO");
                });
        assertThat(reporteRepository.count()).isZero();
    }

    @Test
    void crear_whenTheUserHasTenPendingReports_is409LimiteReportesPendientes_untilOneIsResolved() {
        Long primero = null;
        for (int i = 0; i < ReporteService.MAX_PENDIENTES_POR_USUARIO; i++) {
            Long id = reporteService.crear(inactivo(sinReclamar()), dona.getId()).id();
            if (primero == null) primero = id;
        }
        Organizacion una = sinReclamar();

        assertThatThrownBy(() -> reporteService.crear(inactivo(una), dona.getId()))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getReason()).isEqualTo("LIMITE_REPORTES_PENDIENTES");
                });
        // Another user is not affected, and resolving one frees a slot.
        reporteService.crear(inactivo(una), ana.getId());
        reporteService.descartar(primero, "no", admin.getId());
        assertThat(reporteService.crear(inactivo(una), dona.getId()).estado()).isEqualTo(EstadoReporte.PENDIENTE);
    }

    @Test
    void crear_withTheDailyLimitReachedByPersistedRows_is429DemasiadosReportes_andNothingIsSaved() {
        // Resolved reports still count: the window reads rows, so it needs no in-memory state to survive a restart.
        for (int i = 0; i < 20; i++) {
            ReporteOrganizacion r = new ReporteOrganizacion();
            r.setOrganizacion(sinReclamar());
            r.setReportante(dona);
            r.setMotivo(MotivoReporte.INACTIVO);
            r.setEstado(EstadoReporte.DESCARTADO);
            em.persist(r);
        }
        em.flush();
        Organizacion nueva = sinReclamar();

        assertThatThrownBy(() -> reporteService.crear(inactivo(nueva), dona.getId()))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    assertThat(e.getReason()).isEqualTo("DEMASIADOS_REPORTES");
                });
        assertThat(reporteRepository.count()).isEqualTo(20);
    }

    // --- cross-flow closure ---

    @Test
    void marcarInactiva_autoRejectsThePendingClaimsOnThatOrganizacion_withTheSameEventsAndActivityAsAManualRejection() {
        Organizacion o = sinReclamar();
        Organizacion otra = sinReclamar();
        Long reporte = reporteService.crear(inactivo(o), dona.getId()).id();
        ReclamoOrganizacion c1 = reclamo(o, ana);
        ReclamoOrganizacion ajeno = reclamo(otra, ana);

        reporteService.marcarInactiva(reporte, admin.getId());
        em.flush();
        em.clear();

        ReclamoOrganizacion r = reclamoRepository.findById(c1.getId()).orElseThrow();
        assertThat(r.getEstado()).isEqualTo(EstadoReclamo.RECHAZADO);
        assertThat(r.getMotivoRechazo()).isEqualTo("La organización fue marcada inactiva");
        assertThat(r.getResueltoPor().getId()).isEqualTo(admin.getId());
        assertThat(reclamoRepository.findById(ajeno.getId()).orElseThrow().getEstado()).isEqualTo(EstadoReclamo.PENDIENTE);
        assertThat(eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(o.getId()))
                .extracting(OrganizacionEvento::getTipo)
                .contains(TipoEventoOrganizacion.RECLAMO_RECHAZADO, TipoEventoOrganizacion.REPORTE_CONFIRMADO);
        ArgumentCaptor<ActividadService.Registro> captor = ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService, atLeastOnce()).registrar(captor.capture());
        assertThat(captor.getAllValues()).anySatisfy(g -> {
            assertThat(g.accion()).isEqualTo(TipoActividad.RECLAMO_RECHAZADO);
            assertThat(g.motivo()).isEqualTo("La organización fue marcada inactiva");
        });
    }

    private ReclamoOrganizacion reclamo(Organizacion o, Referente quien) {
        ReclamoOrganizacion c = new ReclamoOrganizacion();
        c.setOrganizacion(o);
        c.setReferente(quien);
        c.setRol(RolReclamo.RESPONSABLE);
        c.setTelefono("351 555 1234");
        return reclamoRepository.saveAndFlush(c);
    }
}
