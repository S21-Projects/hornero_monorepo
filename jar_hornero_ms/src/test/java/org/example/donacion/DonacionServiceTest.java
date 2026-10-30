package org.example.donacion;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.auth.VerificacionService;
import org.example.config.EsquemaVerificador;
import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.example.domain.Asignacion;
import org.example.domain.AsignacionRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoAsignacion;
import org.example.domain.EstadoDonacion;
import org.example.domain.ModalidadDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.UnidadArticulo;
import org.example.donacion.dto.CreateDonacionRequest;
import org.example.donacion.dto.DonacionLineaRequest;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.example.notificacion.NotificacionEvento;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DonacionServiceTest {

    @Mock
    private DonacionRepository donacionRepository;

    @Mock
    private NecesidadRepository necesidadRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private OrganizacionRepository organizacionRepository;

    @Mock
    private VerificacionService verificacionService;

    @Mock
    private EsquemaVerificador esquemaVerificador;

    @Mock
    private AsignacionRepository asignacionRepository;

    @Mock
    private ArticuloRepository articuloRepository;

    @Mock
    private DonanteVisibilidad donanteVisibilidad;

    @Mock
    private ActividadService actividadService;

    @Mock
    private org.springframework.context.ApplicationEventPublisher eventPublisher;

    private DonacionService donacionService;

    /** 2026-10-10 in Argentina; the service reads "today" from this clock (D2/N3). */
    private static final java.time.ZoneId AR = java.time.ZoneId.of("America/Argentina/Buenos_Aires");
    private static final LocalDate HOY = LocalDate.of(2026, 10, 10);
    private final java.time.Clock clock = java.time.Clock.fixed(HOY.atTime(12, 0).atZone(AR).toInstant(), AR);

    private Referente referente;
    private Organizacion miOrganizacion;
    private Donante donante;

    @BeforeEach
    void setUp() {
        donacionService = new DonacionService(donacionRepository, necesidadRepository, usuarioRepository,
                organizacionRepository, verificacionService, esquemaVerificador, asignacionRepository,
                articuloRepository, donanteVisibilidad, clock, actividadService, VentanasDonacion.POR_DEFECTO,
                eventPublisher);
        referente = new Referente(1L, "Ref Test", "ref@test.com", "encoded", true);
        donante = new Donante(2L, "Donante Test", "donante@test.com", "encoded", true);

        miOrganizacion = new Organizacion();
        miOrganizacion.setId(10L);
        miOrganizacion.setNombre("Comedor Test");
        miOrganizacion.setReferente(referente);
        miOrganizacion.setNivel(org.example.domain.NivelAcreditacion.N1);

        // Default: schema already migrated (V001 ran). Only the dedicated ESQUEMA_PENDIENTE test
        // overrides this.
        org.mockito.Mockito.lenient().when(esquemaVerificador.necesidadIdEsNullable()).thenReturn(true);
        org.mockito.Mockito.lenient().when(donanteVisibilidad.paraLlamadaActual())
                .thenReturn(java.util.function.UnaryOperator.identity());
    }

    // ─── catalogo-articulos helpers ─────────────────────────────────────────────

    private Articulo articuloActivo(Long id, CategoriaAlimento categoria) {
        Articulo a = new Articulo();
        a.setId(id);
        a.setNombre("Arroz");
        a.setCategoria(categoria);
        a.setUnidad(UnidadArticulo.KG);
        a.setActivo(true);
        return a;
    }

    private DonacionLineaRequest linea(Long articuloId, String cantidad) {
        DonacionLineaRequest l = new DonacionLineaRequest();
        l.setArticuloId(articuloId);
        l.setCantidad(new java.math.BigDecimal(cantidad));
        return l;
    }

    /** Stubs a single active NO_PERECEDERO articulo (id 1L) and returns a one-line list for it. */
    private List<DonacionLineaRequest> unaLineaNoPerecedero() {
        when(articuloRepository.findById(1L)).thenReturn(Optional.of(articuloActivo(1L, CategoriaAlimento.NO_PERECEDERO)));
        return List.of(linea(1L, "2"));
    }

    /**
     * Attaches a {@link org.example.domain.NecesidadArticulo} selection to {@code necesidad}
     * (closes the C5 gap: a DIRECTA donación must offer at least one articulo the necesidad
     * actually requested). Independent {@link Articulo} instance — only its id matters for the
     * compatibility check.
     */
    private void conArticuloSolicitado(Necesidad necesidad, Long articuloId, CategoriaAlimento categoria) {
        org.example.domain.NecesidadArticulo na = new org.example.domain.NecesidadArticulo();
        na.setArticulo(articuloActivo(articuloId, categoria));
        na.setNecesidad(necesidad);
        necesidad.getArticulos().add(na);
    }

    private Donacion donacionFor(Long id, Organizacion org) {
        Necesidad necesidad = new Necesidad();
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setId(100L + id);
        necesidad.setOrganizacion(org);

        Donacion d = new Donacion();
        d.setId(id);
        d.setFechaOferta(LocalDate.now());
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setDonante(donante);
        d.setNecesidad(necesidad);
        return d;
    }

    /** A vigente (PROPUESTA) {@code Asignacion} row for 5c-ii's accept/devolución/cancel/override
     * resolution tests (AD-3). */
    private Asignacion asignacionVigente() {
        Asignacion a = new Asignacion();
        a.setId(500L);
        a.setEstado(EstadoAsignacion.PROPUESTA);
        return a;
    }

    // --- findDeMisOrganizaciones ---

    @Test
    void findDeMisOrganizaciones_noOrgIdFilter_returnsAcrossAllOwnedOrgs() {
        Pageable pageable = PageRequest.of(0, 20);
        Donacion d1 = donacionFor(1L, miOrganizacion);
        Donacion d2 = donacionFor(2L, miOrganizacion);

        when(donacionRepository.findByOrganizacion_Referente_Id(1L, pageable))
                .thenReturn(new PageImpl<>(List.of(d1, d2), pageable, 45));

        Page<DonacionResponse> result = donacionService.findDeMisOrganizaciones(1L, null, pageable);

        assertThat(result.getContent()).hasSize(2);
        assertThat(result.getContent()).allSatisfy(r -> assertThat(r.organizacionId()).isEqualTo(10L));
        assertThat(result.getTotalElements()).isEqualTo(45);
        assertThat(result.getTotalPages()).isEqualTo(3);
    }

    @Test
    void findDeMisOrganizaciones_withOrgIdFilter_scopesToThatOrg() {
        Pageable pageable = PageRequest.of(1, 5);
        when(organizacionRepository.findByIdAndReferente_Id(10L, 1L)).thenReturn(Optional.of(miOrganizacion));
        when(donacionRepository.findByOrganizacionId(10L, pageable))
                .thenReturn(new PageImpl<>(List.of(donacionFor(1L, miOrganizacion)), pageable, 6));

        Page<DonacionResponse> result = donacionService.findDeMisOrganizaciones(1L, 10L, pageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getNumber()).isEqualTo(1);
        verify(donacionRepository).findByOrganizacionId(10L, pageable);
        verify(donacionRepository, org.mockito.Mockito.never()).findByOrganizacion_Referente_Id(org.mockito.ArgumentMatchers.anyLong(), any(Pageable.class));
    }

    @Test
    void findDeMisOrganizaciones_foreignOrgIdFilter_throwsForbidden() {
        when(organizacionRepository.findByIdAndReferente_Id(20L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> donacionService.findDeMisOrganizaciones(1L, 20L, PageRequest.of(0, 20)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void findDeMisOrganizaciones_noOrgs_returnsEmptyPage() {
        Pageable pageable = PageRequest.of(0, 20);
        when(donacionRepository.findByOrganizacion_Referente_Id(1L, pageable)).thenReturn(Page.empty(pageable));

        Page<DonacionResponse> result = donacionService.findDeMisOrganizaciones(1L, null, pageable);

        assertThat(result.getContent()).isEmpty();
        assertThat(result.getTotalElements()).isZero();
    }

    // --- N13: notification events (published inside the transaction, handled after commit) ---

    @Test
    void crear_directa_publishesDonacionOfrecida() {
        Necesidad necesidad = new Necesidad();
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setId(100L);
        necesidad.setOrganizacion(miOrganizacion);
        conArticuloSolicitado(necesidad, 1L, CategoriaAlimento.NO_PERECEDERO);
        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setNecesidadId(100L);
        dto.setLineas(unaLineaNoPerecedero());
        when(necesidadRepository.findById(100L)).thenReturn(Optional.of(necesidad));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> {
            Donacion x = inv.getArgument(0);
            x.setId(55L);
            return x;
        });

        donacionService.crear(dto, 2L);

        verify(eventPublisher).publishEvent(new NotificacionEvento.DonacionOfrecida(55L));
    }

    @Test
    void crear_fondoComun_publishesNothing_theReferenteIsToldWhenARondaProposesIt() {
        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setModalidad(ModalidadDonacion.FONDO_COMUN);
        dto.setLineas(unaLineaNoPerecedero());
        dto.setLatitud(-34.6);
        dto.setLongitud(-58.4);
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        donacionService.crear(dto, 2L);

        verifyNoInteractions(eventPublisher);
    }

    @Test
    void decidir_aceptada_publishesDonacionDecidida() {
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        donacionService.decidir(1L, EstadoDonacion.ACEPTADA, 1L);

        verify(eventPublisher).publishEvent(new NotificacionEvento.DonacionDecidida(1L, true));
    }

    @Test
    void decidir_directaRechazada_publishesDonacionDecidida() {
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        donacionService.decidir(1L, EstadoDonacion.RECHAZADA, 1L);

        verify(eventPublisher).publishEvent(new NotificacionEvento.DonacionDecidida(1L, false));
    }

    @Test
    void decidir_fondoComunRechazada_returnsToThePoolAndTellsNobody() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setModalidad(ModalidadDonacion.FONDO_COMUN);
        d.getNecesidad().getDonaciones().add(d);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        donacionService.decidir(1L, EstadoDonacion.RECHAZADA, 1L);

        verifyNoInteractions(eventPublisher);
    }

    @Test
    void decidir_forbidden_publishesNothing() {
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.decidir(1L, EstadoDonacion.ACEPTADA, 999L))
                .isInstanceOf(ResponseStatusException.class);

        verifyNoInteractions(eventPublisher);
    }

    @Test
    void cancelarOfertaSinRespuesta_publishesDonacionVencida() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstadoDesde(java.time.Instant.parse("2026-09-01T00:00:00Z"));
        when(donacionRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        boolean cancelo = donacionService.cancelarOfertaSinRespuesta(1L, java.time.Instant.parse("2026-10-03T00:00:00Z"));

        assertThat(cancelo).isTrue();
        verify(eventPublisher).publishEvent(new NotificacionEvento.DonacionVencida(1L));
    }

    @Test
    void cancelarOfertaSinRespuesta_noOp_publishesNothing() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstadoDesde(java.time.Instant.parse("2026-10-09T00:00:00Z"));
        when(donacionRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(d));

        boolean cancelo = donacionService.cancelarOfertaSinRespuesta(1L, java.time.Instant.parse("2026-10-03T00:00:00Z"));

        assertThat(cancelo).isFalse();
        verifyNoInteractions(eventPublisher);
    }

    // --- crear ---

    @Test
    void crear_verifiedDonante_succeeds() {
        Necesidad necesidad = new Necesidad();
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setId(100L);
        necesidad.setOrganizacion(miOrganizacion);
        conArticuloSolicitado(necesidad, 1L, CategoriaAlimento.NO_PERECEDERO);

        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setNecesidadId(100L);
        dto.setObservaciones("Puedo traer 10 litros esta semana");
        dto.setLineas(unaLineaNoPerecedero());

        when(necesidadRepository.findById(100L)).thenReturn(Optional.of(necesidad));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.crear(dto, 2L);

        assertThat(response.necesidadId()).isEqualTo(100L);
        assertThat(response.categoria()).isEqualTo("NO_PERECEDERO");
        assertThat(response.lineas()).hasSize(1);
        verify(verificacionService).requireVerified(2L);
    }

    @Test
    void crear_unverifiedDonante_throwsForbiddenBeforeTouchingNecesidad() {
        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setNecesidadId(100L);

        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "EMAIL_NO_VERIFICADO"))
                .when(verificacionService).requireVerified(2L);

        assertThatThrownBy(() -> donacionService.crear(dto, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("EMAIL_NO_VERIFICADO");

        verifyNoInteractions(necesidadRepository);
    }

    @Test
    void crear_directaToN0Organizacion_throwsConflictAndSavesNothing() {
        miOrganizacion.setNivel(org.example.domain.NivelAcreditacion.N0);
        assertDirectaRechazadaPorNoAprobada();
    }

    @Test
    void crear_directaToNullNivelOrganizacion_isTreatedAsN0() {
        miOrganizacion.setNivel(null);
        assertDirectaRechazadaPorNoAprobada();
    }

    private void assertDirectaRechazadaPorNoAprobada() {
        Necesidad necesidad = new Necesidad();
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setId(100L);
        necesidad.setOrganizacion(miOrganizacion);
        conArticuloSolicitado(necesidad, 1L, CategoriaAlimento.NO_PERECEDERO);

        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setNecesidadId(100L);
        dto.setLineas(List.of(linea(1L, "2")));

        when(necesidadRepository.findById(100L)).thenReturn(Optional.of(necesidad));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));

        assertThatThrownBy(() -> donacionService.crear(dto, 2L))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT))
                .hasMessageContaining("ORGANIZACION_NO_APROBADA");

        verify(donacionRepository, org.mockito.Mockito.never()).save(any(Donacion.class));
    }

    @Test
    void crear_directaToN1Organizacion_isAllowed() {
        Necesidad necesidad = new Necesidad();
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setId(100L);
        necesidad.setOrganizacion(miOrganizacion);
        conArticuloSolicitado(necesidad, 1L, CategoriaAlimento.NO_PERECEDERO);

        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setNecesidadId(100L);
        dto.setLineas(unaLineaNoPerecedero());

        when(necesidadRepository.findById(100L)).thenReturn(Optional.of(necesidad));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThat(donacionService.crear(dto, 2L).necesidadId()).isEqualTo(100L);
    }

    // --- D2/N3: DIRECTA donations only target an open, unexpired necesidad ---

    private Necesidad necesidadDirecta(EstadoNecesidad estado, LocalDate vencimiento) {
        Necesidad necesidad = new Necesidad();
        necesidad.setId(100L);
        necesidad.setEstado(estado);
        necesidad.setFechaVencimiento(vencimiento);
        necesidad.setOrganizacion(miOrganizacion);
        conArticuloSolicitado(necesidad, 1L, CategoriaAlimento.NO_PERECEDERO);
        return necesidad;
    }

    private CreateDonacionRequest directaA100() {
        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setNecesidadId(100L);
        dto.setLineas(List.of(linea(1L, "2")));
        return dto;
    }

    private void assertNecesidadNoDisponible(Necesidad necesidad) {
        when(necesidadRepository.findById(100L)).thenReturn(Optional.of(necesidad));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));

        assertThatThrownBy(() -> donacionService.crear(directaA100(), 2L))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT))
                .hasMessageContaining("NECESIDAD_NO_DISPONIBLE");

        verify(donacionRepository, org.mockito.Mockito.never()).save(any(Donacion.class));
    }

    @Test
    void crear_directaToVencidaNecesidad_throwsConflictAndSavesNothing() {
        assertNecesidadNoDisponible(necesidadDirecta(EstadoNecesidad.VENCIDA, HOY.minusDays(1)));
    }

    @Test
    void crear_directaToCumplidaNecesidad_throwsConflictAndSavesNothing() {
        assertNecesidadNoDisponible(necesidadDirecta(EstadoNecesidad.CUMPLIDA, null));
    }

    @Test
    void crear_directaToAbiertaNecesidadPastItsDate_throwsConflict_evenIfJobHasNotRunYet() {
        assertNecesidadNoDisponible(necesidadDirecta(EstadoNecesidad.ABIERTA, HOY.minusDays(1)));
    }

    @Test
    void crear_directaToNecesidadExpiringToday_isAllowed() {
        when(necesidadRepository.findById(100L))
                .thenReturn(Optional.of(necesidadDirecta(EstadoNecesidad.ABIERTA, HOY)));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));
        when(articuloRepository.findById(1L))
                .thenReturn(Optional.of(articuloActivo(1L, CategoriaAlimento.NO_PERECEDERO)));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThat(donacionService.crear(directaA100(), 2L).necesidadId()).isEqualTo(100L);
    }

    @Test
    void crear_directaToEnProgresoNecesidadWithoutDate_isAllowed() {
        when(necesidadRepository.findById(100L))
                .thenReturn(Optional.of(necesidadDirecta(EstadoNecesidad.EN_PROGRESO, null)));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));
        when(articuloRepository.findById(1L))
                .thenReturn(Optional.of(articuloActivo(1L, CategoriaAlimento.NO_PERECEDERO)));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThat(donacionService.crear(directaA100(), 2L).necesidadId()).isEqualTo(100L);
    }

    // --- decidir (referente: OFRECIDA -> ACEPTADA | RECHAZADA) ---

    @Test
    void decidir_organizacionWithNullReferente_throwsForbidden() {
        miOrganizacion.setReferente(null);
        Donacion d = donacionFor(1L, miOrganizacion);

        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.decidir(1L, EstadoDonacion.ACEPTADA, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void decidir_foreignReferente_throwsForbidden() {
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.decidir(1L, EstadoDonacion.ACEPTADA, 999L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void decidir_ofrecidaToAceptada_succeeds() {
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.decidir(1L, EstadoDonacion.ACEPTADA, 1L);

        assertThat(response.estado()).isEqualTo("ACEPTADA");
    }

    @Test
    void decidir_ofrecidaToAceptada_resuelveAsignacionVigenteComoAceptada() {
        // 5c-ii / AD-3: accepting a FONDO_COMUN donación's offer resolves the ronda's PROPUESTA
        // Asignacion row to ACEPTADA, replacing 5b.12's no-op stub.
        Donacion d = donacionFor(1L, miOrganizacion);
        Asignacion vigente = asignacionVigente();
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(asignacionRepository.findFirstByDonacion_IdAndEstadoOrderByCreadaEnDesc(1L, EstadoAsignacion.PROPUESTA))
                .thenReturn(Optional.of(vigente));

        donacionService.decidir(1L, EstadoDonacion.ACEPTADA, 1L);

        assertThat(vigente.getEstado()).isEqualTo(EstadoAsignacion.ACEPTADA);
        assertThat(vigente.getResueltaEn()).isNotNull();
        verify(asignacionRepository).save(vigente);
    }

    @Test
    void decidir_ofrecidaToAceptada_sinAsignacionVigente_noLanzaYNoGuardaNada() {
        // A DIRECTA donación (or a FONDO_COMUN donación with no PROPUESTA row) has nothing to
        // resolve — this must stay a silent no-op, not an error.
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        donacionService.decidir(1L, EstadoDonacion.ACEPTADA, 1L);

        verify(asignacionRepository, org.mockito.Mockito.never()).save(any(Asignacion.class));
    }

    @Test
    void decidir_ofrecidaToRechazada_succeeds() {
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.decidir(1L, EstadoDonacion.RECHAZADA, 1L);

        assertThat(response.estado()).isEqualTo("RECHAZADA");
    }

    @Test
    void decidir_invalidTargetEstado_throwsBadRequest() {
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.decidir(1L, EstadoDonacion.EN_CAMINO, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void decidir_notOfrecida_throwsBadRequest() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.ACEPTADA);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.decidir(1L, EstadoDonacion.RECHAZADA, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    // --- actualizarEstado (donante logistics: ACEPTADA -> EN_CAMINO, {OFRECIDA,ACEPTADA,EN_CAMINO} -> CANCELADA) ---

    @Test
    void actualizarEstado_foreignDonante_throwsForbidden() {
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.actualizarEstado(1L, EstadoDonacion.CANCELADA, 999L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void actualizarEstado_aceptadaToEnCamino_succeeds() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.ACEPTADA);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.actualizarEstado(1L, EstadoDonacion.EN_CAMINO, 2L);

        assertThat(response.estado()).isEqualTo("EN_CAMINO");
    }

    @Test
    void actualizarEstado_ofrecidaToCancelada_succeeds() {
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.actualizarEstado(1L, EstadoDonacion.CANCELADA, 2L);

        assertThat(response.estado()).isEqualTo("CANCELADA");
    }

    @Test
    void actualizarEstado_cancelada_resuelveAsignacionVigenteComoCancelada() {
        // 5c-ii / AD-3: a donante cancelling an offer resolves the ronda's PROPUESTA Asignacion row
        // to CANCELADA.
        Donacion d = donacionFor(1L, miOrganizacion);
        Asignacion vigente = asignacionVigente();
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(asignacionRepository.findFirstByDonacion_IdAndEstadoOrderByCreadaEnDesc(1L, EstadoAsignacion.PROPUESTA))
                .thenReturn(Optional.of(vigente));

        donacionService.actualizarEstado(1L, EstadoDonacion.CANCELADA, 2L);

        assertThat(vigente.getEstado()).isEqualTo(EstadoAsignacion.CANCELADA);
        assertThat(vigente.getResueltaEn()).isNotNull();
        verify(asignacionRepository).save(vigente);
    }

    @Test
    void actualizarEstado_enCaminoToCancelada_succeeds() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.EN_CAMINO);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.actualizarEstado(1L, EstadoDonacion.CANCELADA, 2L);

        assertThat(response.estado()).isEqualTo("CANCELADA");
    }

    @Test
    void actualizarEstado_invalidTargetEstado_throwsBadRequest() {
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.actualizarEstado(1L, EstadoDonacion.ACEPTADA, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void actualizarEstado_ofrecidaToEnCamino_throwsBadRequest_mustGoThroughAceptadaFirst() {
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.actualizarEstado(1L, EstadoDonacion.EN_CAMINO, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void actualizarEstado_terminalState_throwsBadRequest() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.RECHAZADA);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.actualizarEstado(1L, EstadoDonacion.CANCELADA, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    // confirmarEntrega (the plain unconditional confirm) was retired in slice 3c-ii — spec
    // `donacion-entrega-codigo`'s "Retirement of the Unconditional Confirm Action". The
    // code-verified path's equivalent coverage lives in EntregaServiceTest, which exercises the
    // same shared ConfirmacionEntrega.registrar helper this method used to delegate to.

    // --- overrideEstado (admin escape hatch) ---

    @Test
    void overrideEstado_entregadaTerminal_throwsBadRequest() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.ENTREGADA);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.overrideEstado(1L, EstadoDonacion.CANCELADA, "motivo", 99L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void overrideEstado_rechazadaTerminal_throwsBadRequest() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.RECHAZADA);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.overrideEstado(1L, EstadoDonacion.ENTREGADA, "motivo", 99L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void overrideEstado_canceladaTerminal_throwsBadRequest() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.CANCELADA);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.overrideEstado(1L, EstadoDonacion.ENTREGADA, "motivo", 99L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void overrideEstado_blankMotivo_throwsBadRequestAndDoesNotChangeEstado() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.PENDIENTE_CONFIRMACION);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.overrideEstado(1L, EstadoDonacion.ENTREGADA, "   ", 99L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");

        assertThat(d.getEstado()).isEqualTo(EstadoDonacion.PENDIENTE_CONFIRMACION);
    }

    @Test
    void overrideEstado_noOpTarget_throwsBadRequest() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.ACEPTADA);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.overrideEstado(1L, EstadoDonacion.ACEPTADA, "motivo", 99L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void overrideEstado_pendienteToEntregada_bypassesConfirmationRequirement() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.PENDIENTE_CONFIRMACION);
        // Neither party has confirmed -- override must still succeed.
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.overrideEstado(1L, EstadoDonacion.ENTREGADA, "Entrega verificada por soporte", 99L);

        assertThat(response.estado()).isEqualTo("ENTREGADA");
        assertThat(response.fechaEntrega()).isEqualTo(LocalDate.now());
    }

    @Test
    void overrideEstado_entregada_neverFabricatesConfirmationTimestamps() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.PENDIENTE_CONFIRMACION);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.overrideEstado(1L, EstadoDonacion.ENTREGADA, "Forzado por soporte", 99L);

        assertThat(response.estado()).isEqualTo("ENTREGADA");
        assertThat(response.confirmadaDonanteEn()).isNull();
        assertThat(response.confirmadaReferenteEn()).isNull();
    }

    @Test
    void overrideEstado_toNonTerminalNonPendiente_clearsConfirmationTimestamps() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.EN_CAMINO);
        d.setConfirmadaDonanteEn(java.time.Instant.now());
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.overrideEstado(1L, EstadoDonacion.ACEPTADA, "Reversion manual", 99L);

        assertThat(response.estado()).isEqualTo("ACEPTADA");
        assertThat(response.confirmadaDonanteEn()).isNull();
        assertThat(response.confirmadaReferenteEn()).isNull();
    }

    @Test
    void overrideEstado_persistsAuditFields() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.ACEPTADA);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        donacionService.overrideEstado(1L, EstadoDonacion.CANCELADA, "Donante inalcanzable", 42L);

        assertThat(d.getOverrideMotivo()).isEqualTo("Donante inalcanzable");
        assertThat(d.getOverrideAdminId()).isEqualTo(42L);
        assertThat(d.getOverrideEn()).isNotNull();
    }

    @Test
    void overrideEstado_haciaCancelada_resuelveAsignacionVigenteComoCancelada() {
        // 5c-ii / AD-3: an admin override to ACEPTADA/RECHAZADA/CANCELADA resolves the vigente
        // Asignacion the same way the ordinary accept/devolución/cancel paths do.
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.ACEPTADA);
        Asignacion vigente = asignacionVigente();
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(asignacionRepository.findFirstByDonacion_IdAndEstadoOrderByCreadaEnDesc(1L, EstadoAsignacion.PROPUESTA))
                .thenReturn(Optional.of(vigente));

        donacionService.overrideEstado(1L, EstadoDonacion.CANCELADA, "Donante inalcanzable", 42L);

        assertThat(vigente.getEstado()).isEqualTo(EstadoAsignacion.CANCELADA);
        assertThat(vigente.getResueltaEn()).isNotNull();
    }

    @Test
    void overrideEstado_haciaEntregada_noResuelveAsignacion_noEsUnEstadoDeAsignacion() {
        // ENTREGADA (and EN_CAMINO / PENDIENTE_CONFIRMACION) have no matching EstadoAsignacion —
        // overriding into one of them must not touch the Asignacion history at all.
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.PENDIENTE_CONFIRMACION);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        donacionService.overrideEstado(1L, EstadoDonacion.ENTREGADA, "Entrega verificada por soporte", 42L);

        verify(asignacionRepository, org.mockito.Mockito.never())
                .findFirstByDonacion_IdAndEstadoOrderByCreadaEnDesc(any(), any());
    }

    // ─── findActivas ───────────────────────────────────────────────────────

    @Test
    void findActivas_noEstadoFilter_queriesNoTerminales() {
        var pageable = org.springframework.data.domain.PageRequest.of(0, 20);
        when(donacionRepository.findActivas(eq(EstadoDonacion.NO_TERMINALES), eq(null), eq(false),
                any(), any(), any(), any(), eq(pageable)))
                .thenReturn(org.springframework.data.domain.Page.empty());

        donacionService.findActivas(null, null, false, pageable);

        verify(donacionRepository).findActivas(eq(EstadoDonacion.NO_TERMINALES), eq(null), eq(false),
                any(), any(), any(), any(), eq(pageable));
    }

    @Test
    void findActivas_estadoFilter_queriesSingleEstado() {
        var pageable = org.springframework.data.domain.PageRequest.of(0, 20);
        when(donacionRepository.findActivas(eq(java.util.EnumSet.of(EstadoDonacion.ACEPTADA)), eq("org"), eq(false),
                any(), any(), any(), any(), eq(pageable)))
                .thenReturn(org.springframework.data.domain.Page.empty());

        donacionService.findActivas("org", EstadoDonacion.ACEPTADA, false, pageable);

        verify(donacionRepository).findActivas(eq(java.util.EnumSet.of(EstadoDonacion.ACEPTADA)), eq("org"), eq(false),
                any(), any(), any(), any(), eq(pageable));
    }

    @Test
    void findActivas_terminalEstadoFilter_rejectedWith400() {
        var pageable = org.springframework.data.domain.PageRequest.of(0, 20);

        assertThatThrownBy(() -> donacionService.findActivas(null, EstadoDonacion.ENTREGADA, false, pageable))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400")
                .hasMessageContaining("ENTREGADA");
        verifyNoInteractions(donacionRepository);
    }

    @Test
    void findActivas_soloEstancadas_passesTheWindowCutoffsFromTheClock() {
        var pageable = org.springframework.data.domain.PageRequest.of(0, 20);
        java.time.Instant ahora = clock.instant();
        java.time.Instant corteEnCurso = ahora.minus(java.time.Duration.ofDays(14));
        java.time.Instant corteConfirmacion = ahora.minus(java.time.Duration.ofDays(7));
        when(donacionRepository.findActivas(any(), any(), eq(true), any(), any(), any(), any(), eq(pageable)))
                .thenReturn(org.springframework.data.domain.Page.empty());

        donacionService.findActivas(null, null, true, pageable);

        verify(donacionRepository).findActivas(eq(EstadoDonacion.NO_TERMINALES), eq(null), eq(true),
                eq(corteEnCurso), eq(Donacion.fechaLimiteFallback(corteEnCurso, AR)),
                eq(corteConfirmacion), eq(Donacion.fechaLimiteFallback(corteConfirmacion, AR)), eq(pageable));
    }

    @Test
    void findActivas_response_carriesEstancadaAndDiasEnEstado() {
        var pageable = org.springframework.data.domain.PageRequest.of(0, 20);
        Donacion vieja = donacionFor(1L, miOrganizacion);
        vieja.setEstado(EstadoDonacion.ACEPTADA);
        vieja.setEstadoDesde(clock.instant().minus(java.time.Duration.ofDays(20)));
        Donacion fresca = donacionFor(2L, miOrganizacion);
        fresca.setEstado(EstadoDonacion.ACEPTADA);
        fresca.setEstadoDesde(clock.instant().minus(java.time.Duration.ofDays(2)));
        when(donacionRepository.findActivas(any(), any(), eq(false), any(), any(), any(), any(), eq(pageable)))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(vieja, fresca)));

        var page = donacionService.findActivas(null, null, false, pageable);

        assertThat(page.getContent().get(0).estancada()).isTrue();
        assertThat(page.getContent().get(0).diasEnEstado()).isEqualTo(20);
        assertThat(page.getContent().get(1).estancada()).isFalse();
        assertThat(page.getContent().get(1).diasEnEstado()).isEqualTo(2);
    }

    // ─── N12: estadoDesde is stamped on every estado change ─────────────────────────────────────

    @Test
    void crear_stampsEstadoDesdeFromTheClock() {
        // reuse the happy-path fixture of crear_verifiedDonante_succeeds
        Donacion d = new Donacion();
        d.cambiarEstado(EstadoDonacion.OFRECIDA, clock);
        assertThat(d.getEstadoDesde()).isEqualTo(clock.instant());
    }

    @Test
    void decidir_aceptada_stampsEstadoDesde() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstadoDesde(clock.instant().minus(java.time.Duration.ofDays(30)));
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        donacionService.decidir(1L, EstadoDonacion.ACEPTADA, 1L);

        assertThat(d.getEstadoDesde()).isEqualTo(clock.instant());
    }

    @Test
    void actualizarEstado_enCamino_stampsEstadoDesde() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.ACEPTADA);
        d.setEstadoDesde(clock.instant().minus(java.time.Duration.ofDays(30)));
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        donacionService.actualizarEstado(1L, EstadoDonacion.EN_CAMINO, 2L);

        assertThat(d.getEstadoDesde()).isEqualTo(clock.instant());
    }

    @Test
    void overrideEstado_stampsEstadoDesde() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setEstado(EstadoDonacion.ACEPTADA);
        d.setEstadoDesde(clock.instant().minus(java.time.Duration.ofDays(30)));
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        donacionService.overrideEstado(1L, EstadoDonacion.EN_CAMINO, "destrabada", 99L);

        assertThat(d.getEstadoDesde()).isEqualTo(clock.instant());
    }

    // ─── crear — modalidad (slice 5b, AD-3/AD-13, spec donacion-fondo-comun) ──────────────────

    @Test
    void crear_directaConNecesidadId_persisteModalidadDirecta_comportamientoSinCambios() {
        Necesidad necesidad = new Necesidad();
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setId(100L);
        necesidad.setOrganizacion(miOrganizacion);
        conArticuloSolicitado(necesidad, 1L, CategoriaAlimento.NO_PERECEDERO);

        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setModalidad(ModalidadDonacion.DIRECTA);
        dto.setNecesidadId(100L);
        dto.setLineas(unaLineaNoPerecedero());

        when(necesidadRepository.findById(100L)).thenReturn(Optional.of(necesidad));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.crear(dto, 2L);

        assertThat(response.necesidadId()).isEqualTo(100L);
        assertThat(response.modalidad()).isEqualTo("DIRECTA");
    }

    @Test
    void crear_modalidadOmitida_defaultsToDirecta_backwardCompatible() {
        Necesidad necesidad = new Necesidad();
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setId(100L);
        necesidad.setOrganizacion(miOrganizacion);
        conArticuloSolicitado(necesidad, 1L, CategoriaAlimento.NO_PERECEDERO);

        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setNecesidadId(100L);
        dto.setLineas(unaLineaNoPerecedero());

        when(necesidadRepository.findById(100L)).thenReturn(Optional.of(necesidad));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.crear(dto, 2L);

        assertThat(response.modalidad()).isEqualTo("DIRECTA");
    }

    @Test
    void crear_directaSinNecesidadId_throwsBadRequest() {
        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setModalidad(ModalidadDonacion.DIRECTA);

        assertThatThrownBy(() -> donacionService.crear(dto, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
        verifyNoInteractions(necesidadRepository);
    }

    @Test
    void crear_directaConCoordenadas_throwsBadRequest() {
        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setModalidad(ModalidadDonacion.DIRECTA);
        dto.setNecesidadId(100L);
        dto.setLatitud(-34.6);
        dto.setLongitud(-58.4);

        assertThatThrownBy(() -> donacionService.crear(dto, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void crear_fondoComun_conCoordenadas_derivaCategoriaDeLasLineas_persisteSinNecesidad() {
        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setModalidad(ModalidadDonacion.FONDO_COMUN);
        dto.setLineas(unaLineaNoPerecedero());
        dto.setLatitud(-34.6);
        dto.setLongitud(-58.4);

        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.crear(dto, 2L);

        assertThat(response.modalidad()).isEqualTo("FONDO_COMUN");
        assertThat(response.categoria()).isEqualTo("NO_PERECEDERO");
        assertThat(response.necesidadId()).isNull();
        assertThat(response.organizacionId()).isNull();
        verifyNoInteractions(necesidadRepository);
    }

    @Test
    void crear_fondoComun_conNecesidadId_throwsBadRequest() {
        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setModalidad(ModalidadDonacion.FONDO_COMUN);
        dto.setNecesidadId(100L);
        dto.setLatitud(-34.6);
        dto.setLongitud(-58.4);

        assertThatThrownBy(() -> donacionService.crear(dto, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void crear_sinLineas_throwsBadRequest() {
        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setModalidad(ModalidadDonacion.FONDO_COMUN);
        dto.setLatitud(-34.6);
        dto.setLongitud(-58.4);
        dto.setLineas(List.of());

        assertThatThrownBy(() -> donacionService.crear(dto, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void crear_lineaConArticuloInactivo_throwsBadRequest() {
        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setModalidad(ModalidadDonacion.FONDO_COMUN);
        dto.setLatitud(-34.6);
        dto.setLongitud(-58.4);
        dto.setLineas(List.of(linea(1L, "2")));

        Articulo inactivo = articuloActivo(1L, CategoriaAlimento.NO_PERECEDERO);
        inactivo.setActivo(false);
        when(articuloRepository.findById(1L)).thenReturn(Optional.of(inactivo));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));

        assertThatThrownBy(() -> donacionService.crear(dto, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void crear_lineaConArticuloDesconocido_throwsBadRequest() {
        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setModalidad(ModalidadDonacion.FONDO_COMUN);
        dto.setLatitud(-34.6);
        dto.setLongitud(-58.4);
        dto.setLineas(List.of(linea(999L, "2")));

        when(articuloRepository.findById(999L)).thenReturn(Optional.empty());
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));

        assertThatThrownBy(() -> donacionService.crear(dto, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void crear_lineasMixtas_categoriaDerivadaEsLaMasExigente() {
        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setModalidad(ModalidadDonacion.FONDO_COMUN);
        dto.setLatitud(-34.6);
        dto.setLongitud(-58.4);
        dto.setLineas(List.of(linea(1L, "2"), linea(2L, "1")));

        when(articuloRepository.findById(1L)).thenReturn(Optional.of(articuloActivo(1L, CategoriaAlimento.NO_PERECEDERO)));
        when(articuloRepository.findById(2L)).thenReturn(Optional.of(articuloActivo(2L, CategoriaAlimento.CONGELADO)));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.crear(dto, 2L);

        assertThat(response.categoria()).isEqualTo("CONGELADO");
        assertThat(response.lineas()).hasSize(2);
    }

    @Test
    void crear_fondoComun_sinCoordenadas_throwsBadRequest() {
        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setModalidad(ModalidadDonacion.FONDO_COMUN);
        dto.setLineas(List.of(linea(1L, "2")));

        assertThatThrownBy(() -> donacionService.crear(dto, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void crear_fondoComun_esquemaPendiente_throwsServiceUnavailable_directaUnaffected() {
        when(esquemaVerificador.necesidadIdEsNullable()).thenReturn(false);
        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setModalidad(ModalidadDonacion.FONDO_COMUN);
        dto.setLatitud(-34.6);
        dto.setLongitud(-58.4);
        dto.setLineas(List.of(linea(1L, "2")));

        assertThatThrownBy(() -> donacionService.crear(dto, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("503")
                .hasMessageContaining("ESQUEMA_PENDIENTE");

        // DIRECTA is never gated by the flag.
        Necesidad necesidad = new Necesidad();
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setId(100L);
        necesidad.setOrganizacion(miOrganizacion);
        conArticuloSolicitado(necesidad, 1L, CategoriaAlimento.NO_PERECEDERO);
        CreateDonacionRequest directa = new CreateDonacionRequest();
        directa.setModalidad(ModalidadDonacion.DIRECTA);
        directa.setNecesidadId(100L);
        directa.setLineas(unaLineaNoPerecedero());
        when(necesidadRepository.findById(100L)).thenReturn(Optional.of(necesidad));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.crear(directa, 2L);
        assertThat(response.modalidad()).isEqualTo("DIRECTA");
    }

    // ─── crear — DIRECTA articulo compatibility (closes the C5 gap) ───────────────────────────

    @Test
    void crear_directaArticuloNoSolicitadoPorLaNecesidad_throwsBadRequest() {
        Necesidad necesidad = new Necesidad();
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setId(100L);
        necesidad.setOrganizacion(miOrganizacion);
        // The necesidad only requests articulo 2 (CONGELADO); the donación offers articulo 1.
        conArticuloSolicitado(necesidad, 2L, CategoriaAlimento.CONGELADO);

        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setModalidad(ModalidadDonacion.DIRECTA);
        dto.setNecesidadId(100L);
        dto.setLineas(unaLineaNoPerecedero());

        when(necesidadRepository.findById(100L)).thenReturn(Optional.of(necesidad));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));

        assertThatThrownBy(() -> donacionService.crear(dto, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400")
                .hasMessageContaining("ARTICULO_INCOMPATIBLE");

        verifyNoInteractions(donacionRepository);
    }

    @Test
    void crear_directaArticuloCompartidoEntreVariasLineas_succeeds() {
        Necesidad necesidad = new Necesidad();
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setId(100L);
        necesidad.setOrganizacion(miOrganizacion);
        conArticuloSolicitado(necesidad, 2L, CategoriaAlimento.CONGELADO);

        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setModalidad(ModalidadDonacion.DIRECTA);
        dto.setNecesidadId(100L);
        // Offers articulo 1 (not requested) AND articulo 2 (requested) — one shared articulo is
        // enough.
        when(articuloRepository.findById(1L)).thenReturn(Optional.of(articuloActivo(1L, CategoriaAlimento.NO_PERECEDERO)));
        when(articuloRepository.findById(2L)).thenReturn(Optional.of(articuloActivo(2L, CategoriaAlimento.CONGELADO)));
        dto.setLineas(List.of(linea(1L, "1"), linea(2L, "1")));

        when(necesidadRepository.findById(100L)).thenReturn(Optional.of(necesidad));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.crear(dto, 2L);

        assertThat(response.modalidad()).isEqualTo("DIRECTA");
    }

    @Test
    void modalidad_nuncaExpuestaComoActualizable_ningunMetodoDeServicioLaCambia() {
        // No DTO in this service (DecisionDonacionRequest, UpdateEstadoDonacionRequest,
        // OverrideEstadoRequest) carries a `modalidad` field, and `modalidad` is `updatable = false`
        // at the JPA column level — this test pins that overrideEstado (the broadest escape hatch)
        // never touches it even if a future refactor adds a setter call by mistake.
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setModalidad(ModalidadDonacion.FONDO_COMUN);
        d.setEstado(EstadoDonacion.ACEPTADA);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.overrideEstado(1L, EstadoDonacion.CANCELADA, "motivo", 99L);

        assertThat(response.modalidad()).isEqualTo("FONDO_COMUN");
    }

    // ─── eliminar — FONDO_COMUN cannot be deleted (AD-3) ───────────────────────────────────────

    @Test
    void eliminar_fondoComun_throwsConflict_usarCancelacion() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setModalidad(ModalidadDonacion.FONDO_COMUN);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.eliminar(1L, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409")
                .hasMessageContaining("USAR_CANCELACION");
        org.mockito.Mockito.verify(donacionRepository, org.mockito.Mockito.never()).delete(any(Donacion.class));
    }

    @Test
    void eliminar_directaOfrecida_seguraFuncionandoIgual() {
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        donacionService.eliminar(1L, 2L);

        org.mockito.Mockito.verify(donacionRepository).delete(d);
    }

    // ─── decidir — devolución al fondo (AD-3) ──────────────────────────────────────────────────

    @Test
    void decidir_fondoComunAsignada_rechazada_devuelveAlFondo_noQuedaRechazada() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setModalidad(ModalidadDonacion.FONDO_COMUN);
        Necesidad necesidadAsignada = d.getNecesidad();
        necesidadAsignada.getDonaciones().add(d);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.decidir(1L, EstadoDonacion.RECHAZADA, 1L);

        assertThat(response.estado()).isEqualTo("OFRECIDA");
        assertThat(response.necesidadId()).isNull();
        assertThat(d.getNecesidad()).isNull();
    }

    @Test
    void decidir_fondoComunAsignada_rechazada_resuelveAsignacionVigenteComoRechazada() {
        // 5c-ii / AD-3: a devolución al fondo resolves the ronda's PROPUESTA Asignacion row to
        // RECHAZADA, which is also what excludes this organización from a later ronda for this
        // donación (AsignacionRepository.findOrganizacionIdsByDonacionIdAndEstado).
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setModalidad(ModalidadDonacion.FONDO_COMUN);
        Necesidad necesidadAsignada = d.getNecesidad();
        necesidadAsignada.getDonaciones().add(d);
        Asignacion vigente = asignacionVigente();
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(asignacionRepository.findFirstByDonacion_IdAndEstadoOrderByCreadaEnDesc(1L, EstadoAsignacion.PROPUESTA))
                .thenReturn(Optional.of(vigente));

        donacionService.decidir(1L, EstadoDonacion.RECHAZADA, 1L);

        assertThat(vigente.getEstado()).isEqualTo(EstadoAsignacion.RECHAZADA);
        assertThat(vigente.getResueltaEn()).isNotNull();
        verify(asignacionRepository).save(vigente);
    }

    @Test
    void decidir_fondoComunAsignada_rechazada_noEliminaLaDonacionDeNecesidadDonaciones_gotchaOrphanRemoval() {
        // AD-3's pinned gotcha: Necesidad.donaciones is @OneToMany(orphanRemoval = true). Devolución
        // MUST only null the owning side (donacion.setNecesidad(null)) and MUST NOT remove the
        // donación from necesidad.getDonaciones(), or Hibernate would delete the row on flush.
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setModalidad(ModalidadDonacion.FONDO_COMUN);
        Necesidad necesidadAsignada = d.getNecesidad();
        necesidadAsignada.getDonaciones().add(d);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        donacionService.decidir(1L, EstadoDonacion.RECHAZADA, 1L);

        assertThat(necesidadAsignada.getDonaciones()).contains(d);
    }

    @Test
    void decidir_fondoComunSinNecesidadAun_rechazada_throwsBadRequest_noEsUnaAsignacionVigente() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setModalidad(ModalidadDonacion.FONDO_COMUN);
        d.setNecesidad(null);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.decidir(1L, EstadoDonacion.RECHAZADA, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void decidir_directaOfrecida_rechazada_siguePermaneciendoRechazadaTerminal_comportamientoSinCambios() {
        Donacion d = donacionFor(1L, miOrganizacion);
        d.setModalidad(ModalidadDonacion.DIRECTA);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.decidir(1L, EstadoDonacion.RECHAZADA, 1L);

        assertThat(response.estado()).isEqualTo("RECHAZADA");
        assertThat(response.necesidadId()).isNotNull();
    }

    // ─── toResponse / toActivaResponse — null-safety for an unassigned pool donation ──────────

    @Test
    void toResponse_donacionSinNecesidad_noLanzaNpe_camposAusentes() {
        Donacion d = new Donacion();
        d.setId(5L);
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setModalidad(ModalidadDonacion.FONDO_COMUN);
        d.setDonante(donante);
        d.setFechaOferta(LocalDate.now());
        d.setNecesidad(null);
        when(donacionRepository.findByIdWithRelations(5L)).thenReturn(Optional.of(d));

        DonacionResponse response = donacionService.findById(5L);

        assertThat(response.necesidadId()).isNull();
        assertThat(response.organizacionId()).isNull();
        assertThat(response.fase()).isEqualTo("EN_FONDO");
    }

    // ─── D5: donor identity on public reads goes through DonanteVisibilidad ───────────────

    private DonacionResponse masked(DonacionResponse r) {
        return new DonacionResponse(r.id(), r.fechaOferta(), r.fechaEntrega(), r.estado(),
                r.observaciones(), null, r.necesidadId(), r.organizacionId(),
                r.necesidadDescripcion(), r.organizacionNombre(), null, null, null,
                r.modalidad(), r.categoria(), r.fase(), r.lineas());
    }

    @Test
    void findById_appliesDonorVisibilityPolicy() {
        Donacion d = donacionFor(7L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(7L)).thenReturn(Optional.of(d));
        when(donanteVisibilidad.paraLlamadaActual()).thenReturn(this::masked);

        DonacionResponse response = donacionService.findById(7L);

        assertThat(response.donanteName()).isNull();
        assertThat(response.donanteId()).isNull();
    }

    @Test
    void findByOrganizacion_appliesDonorVisibilityPolicyToEveryRow() {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, 20);
        when(donacionRepository.findByOrganizacionId(10L, pageable)).thenReturn(
                new org.springframework.data.domain.PageImpl<>(List.of(donacionFor(1L, miOrganizacion), donacionFor(2L, miOrganizacion))));
        when(donanteVisibilidad.paraLlamadaActual()).thenReturn(this::masked);

        var page = donacionService.findByOrganizacion(10L, pageable);

        assertThat(page.getContent()).hasSize(2).allSatisfy(r -> assertThat(r.donanteName()).isNull());
    }

    @Test
    void findAll_appliesDonorVisibilityPolicy() {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, 20);
        when(donacionRepository.findAllWithDonante(pageable)).thenReturn(
                new org.springframework.data.domain.PageImpl<>(List.of(donacionFor(1L, miOrganizacion))));
        when(donanteVisibilidad.paraLlamadaActual()).thenReturn(this::masked);

        assertThat(donacionService.findAll(pageable).getContent().get(0).donanteName()).isNull();
    }

    // --- N10: activity log hooks ---

    @Test
    void decidir_recordsEstadoChangeInSameTransaction() {
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        donacionService.decidir(1L, EstadoDonacion.ACEPTADA, 1L);

        org.mockito.ArgumentCaptor<ActividadService.Registro> captor =
                org.mockito.ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService).registrar(captor.capture());
        ActividadService.Registro r = captor.getValue();
        assertThat(r.accion()).isEqualTo(TipoActividad.DONACION_DECISION);
        assertThat(r.entidadTipo()).isEqualTo("DONACION");
        assertThat(r.entidadId()).isEqualTo(1L);
        assertThat(r.antes()).isEqualTo("OFRECIDA");
        assertThat(r.despues()).isEqualTo("ACEPTADA");
    }

    @Test
    void decidir_forbiddenAttempt_recordsNothing() {
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.decidir(1L, EstadoDonacion.ACEPTADA, 999L))
                .isInstanceOf(ResponseStatusException.class);

        verify(actividadService, org.mockito.Mockito.never()).registrar(any());
    }

    @Test
    void actualizarEstado_toCancelada_recordsDonacionCancelada() {
        Donacion d = donacionFor(1L, miOrganizacion);
        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        donacionService.actualizarEstado(1L, EstadoDonacion.CANCELADA, d.getDonante().getId());

        org.mockito.ArgumentCaptor<ActividadService.Registro> captor =
                org.mockito.ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService).registrar(captor.capture());
        assertThat(captor.getValue().accion()).isEqualTo(TipoActividad.DONACION_CANCELADA);
        assertThat(captor.getValue().despues()).isEqualTo("CANCELADA");
    }
}
