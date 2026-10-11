package org.example.necesidad;

import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.mockito.ArgumentMatchers;
import org.example.actividad.TipoActividad;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.example.actividad.ActividadService;
import org.example.auth.VerificacionService;
import org.example.config.AcreditacionProperties;
import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.EstadoNecesidad;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.example.domain.UnidadArticulo;
import org.example.necesidad.dto.ActualizarNecesidadRequest;
import org.example.necesidad.dto.CrearNecesidadRequest;
import org.example.necesidad.dto.RelanzarNecesidadRequest;
import org.example.user.Referente;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** D2/N4: relaunching an expired necesidad, update rules around VENCIDA, and public listing. */
@ExtendWith(MockitoExtension.class)
class NecesidadServiceRelanzarTest {

    private static final ZoneId BA = ZoneId.of("America/Argentina/Buenos_Aires");
    private static final LocalDate HOY = LocalDate.of(2026, 10, 10);

    @Mock private NecesidadRepository necesidadRepository;
    @Mock private OrganizacionRepository organizacionRepository;
    @Mock private VerificacionService verificacionService;
    @Mock private AcreditacionProperties acreditacionProperties;
    @Mock private ArticuloRepository articuloRepository;
    @Mock private ActividadService actividadService;

    private NecesidadService service;
    private Organizacion org;
    private Referente referente;
    private final Pageable pageable = PageRequest.of(0, 20);

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(HOY.atTime(12, 0).atZone(BA).toInstant(), BA);
        service = new NecesidadService(necesidadRepository, organizacionRepository, verificacionService,
                acreditacionProperties, articuloRepository, clock, actividadService);
        referente = new Referente(1L, "Ref", "ref@test.com", "x", true);
        org = new Organizacion();
        org.setId(1L);
        org.setNivel(NivelAcreditacion.N1);
        org.setReferente(referente);
        lenient().when(acreditacionProperties.capPara(NivelAcreditacion.N1)).thenReturn(3L);
        lenient().when(necesidadRepository.countByOrganizacion_IdAndEstadoIn(eq(1L), any())).thenReturn(0L);
        lenient().when(necesidadRepository.save(any(Necesidad.class))).thenAnswer(i -> i.getArgument(0));
        Articulo a = new Articulo();
        a.setId(1L);
        a.setNombre("Arroz");
        a.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        a.setUnidad(UnidadArticulo.KG);
        a.setActivo(true);
        lenient().when(articuloRepository.findById(1L)).thenReturn(Optional.of(a));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private Necesidad necesidad(EstadoNecesidad estado, LocalDate vence) {
        Necesidad n = new Necesidad();
        n.setId(10L);
        n.setDescripcion("d");
        n.setPrioridad(PrioridadNecesidad.MEDIA);
        n.setEstado(estado);
        n.setFechaPublicacion(HOY.minusDays(40));
        n.setFechaVencimiento(vence);
        n.setOrganizacion(org);
        return n;
    }

    private void expectStatus(Runnable call, HttpStatus status, String fragment) {
        assertThatThrownBy(call::run)
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(status))
                .hasMessageContaining(fragment);
    }

    private void login(long id, String role) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(id, null, List.of(new SimpleGrantedAuthority(role))));
    }

    // --- relanzar ---

    @Test
    void relanzar_vencida_reopensWithNewDateAndRepublishes() {
        Necesidad n = necesidad(EstadoNecesidad.VENCIDA, HOY.minusDays(1));
        when(necesidadRepository.findById(10L)).thenReturn(Optional.of(n));

        NecesidadResponse r = service.relanzar(10L, new RelanzarNecesidadRequest(HOY.plusDays(7)), 1L);

        assertThat(r.estado()).isEqualTo("ABIERTA");
        assertThat(r.fechaVencimiento()).isEqualTo(HOY.plusDays(7));
        assertThat(r.fechaPublicacion()).isEqualTo(HOY);
        verify(necesidadRepository).save(n);
    }

    @Test
    void relanzar_notVencida_conflict() {
        when(necesidadRepository.findById(10L))
                .thenReturn(Optional.of(necesidad(EstadoNecesidad.ABIERTA, HOY.plusDays(3))));

        expectStatus(() -> service.relanzar(10L, new RelanzarNecesidadRequest(HOY.plusDays(7)), 1L),
                HttpStatus.CONFLICT, "NECESIDAD_NO_VENCIDA");
        verify(necesidadRepository, never()).save(any());
    }

    @Test
    void relanzar_todayOrPastDate_badRequest() {
        when(necesidadRepository.findById(10L))
                .thenReturn(Optional.of(necesidad(EstadoNecesidad.VENCIDA, HOY.minusDays(1))));

        expectStatus(() -> service.relanzar(10L, new RelanzarNecesidadRequest(HOY), 1L),
                HttpStatus.BAD_REQUEST, "FECHA_VENCIMIENTO_PASADA");
        expectStatus(() -> service.relanzar(10L, new RelanzarNecesidadRequest(HOY.minusDays(2)), 1L),
                HttpStatus.BAD_REQUEST, "FECHA_VENCIMIENTO_PASADA");
        verify(necesidadRepository, never()).save(any());
    }

    @Test
    void relanzar_capReached_conflict() {
        when(necesidadRepository.findById(10L))
                .thenReturn(Optional.of(necesidad(EstadoNecesidad.VENCIDA, HOY.minusDays(1))));
        when(necesidadRepository.countByOrganizacion_IdAndEstadoIn(eq(1L), any())).thenReturn(3L);

        expectStatus(() -> service.relanzar(10L, new RelanzarNecesidadRequest(HOY.plusDays(7)), 1L),
                HttpStatus.CONFLICT, "máximo de 3");
        verify(necesidadRepository, never()).save(any());
    }

    @Test
    void relanzar_n0Organizacion_conflict() {
        org.setNivel(NivelAcreditacion.N0);
        when(acreditacionProperties.capPara(NivelAcreditacion.N0)).thenReturn(0L);
        when(necesidadRepository.findById(10L))
                .thenReturn(Optional.of(necesidad(EstadoNecesidad.VENCIDA, HOY.minusDays(1))));

        expectStatus(() -> service.relanzar(10L, new RelanzarNecesidadRequest(HOY.plusDays(7)), 1L),
                HttpStatus.CONFLICT, "máximo de 0");
    }

    @Test
    void relanzar_foreignReferente_forbidden() {
        when(necesidadRepository.findById(10L))
                .thenReturn(Optional.of(necesidad(EstadoNecesidad.VENCIDA, HOY.minusDays(1))));

        expectStatus(() -> service.relanzar(10L, new RelanzarNecesidadRequest(HOY.plusDays(7)), 99L),
                HttpStatus.FORBIDDEN, "Access denied");
        verify(necesidadRepository, never()).save(any());
    }

    @Test
    void relanzar_unknownId_notFound() {
        when(necesidadRepository.findById(10L)).thenReturn(Optional.empty());

        expectStatus(() -> service.relanzar(10L, new RelanzarNecesidadRequest(HOY.plusDays(7)), 1L),
                HttpStatus.NOT_FOUND, "not found");
    }

    // --- actualizar ---

    @Test
    void actualizar_leavingVencidaViaPatch_conflict() {
        when(necesidadRepository.findById(10L))
                .thenReturn(Optional.of(necesidad(EstadoNecesidad.VENCIDA, HOY.minusDays(1))));
        ActualizarNecesidadRequest dto = new ActualizarNecesidadRequest();
        dto.setEstado(EstadoNecesidad.ABIERTA);
        dto.setFechaVencimiento(HOY.plusDays(5));

        expectStatus(() -> service.actualizar(10L, dto, 1L), HttpStatus.CONFLICT, "NECESIDAD_VENCIDA_USAR_RELANZAR");
        verify(necesidadRepository, never()).save(any());
    }

    @Test
    void actualizar_vencidaKeepingVencida_isAllowed() {
        Necesidad n = necesidad(EstadoNecesidad.VENCIDA, HOY.minusDays(1));
        when(necesidadRepository.findById(10L)).thenReturn(Optional.of(n));
        ActualizarNecesidadRequest dto = new ActualizarNecesidadRequest();
        dto.setEstado(EstadoNecesidad.VENCIDA);
        dto.setDescripcion("nueva");

        assertThat(service.actualizar(10L, dto, 1L).estado()).isEqualTo("VENCIDA");
    }

    @Test
    void actualizar_openEstadoWithPastDate_badRequest() {
        when(necesidadRepository.findById(10L))
                .thenReturn(Optional.of(necesidad(EstadoNecesidad.CUMPLIDA, null)));
        ActualizarNecesidadRequest dto = new ActualizarNecesidadRequest();
        dto.setEstado(EstadoNecesidad.ABIERTA);
        dto.setFechaVencimiento(HOY.minusDays(1));

        expectStatus(() -> service.actualizar(10L, dto, 1L), HttpStatus.BAD_REQUEST, "FECHA_VENCIMIENTO_PASADA");
    }

    @Test
    void actualizar_pastDateOnAbiertaWithoutEstadoInPayload_badRequest() {
        when(necesidadRepository.findById(10L))
                .thenReturn(Optional.of(necesidad(EstadoNecesidad.ABIERTA, HOY.plusDays(3))));
        ActualizarNecesidadRequest dto = new ActualizarNecesidadRequest();
        dto.setFechaVencimiento(HOY.minusDays(1));

        expectStatus(() -> service.actualizar(10L, dto, 1L), HttpStatus.BAD_REQUEST, "FECHA_VENCIMIENTO_PASADA");
    }

    @Test
    void actualizar_manualVencidaAndCumplida_stillAllowed() {
        Necesidad n = necesidad(EstadoNecesidad.ABIERTA, HOY.plusDays(3));
        when(necesidadRepository.findById(10L)).thenReturn(Optional.of(n));
        ActualizarNecesidadRequest dto = new ActualizarNecesidadRequest();
        dto.setEstado(EstadoNecesidad.VENCIDA);
        assertThat(service.actualizar(10L, dto, 1L).estado()).isEqualTo("VENCIDA");

        n.setEstado(EstadoNecesidad.ABIERTA);
        dto.setEstado(EstadoNecesidad.CUMPLIDA);
        assertThat(service.actualizar(10L, dto, 1L).estado()).isEqualTo("CUMPLIDA");
    }

    @Test
    void actualizar_pastDateWhileClosing_isAllowed() {
        Necesidad n = necesidad(EstadoNecesidad.ABIERTA, HOY.plusDays(3));
        when(necesidadRepository.findById(10L)).thenReturn(Optional.of(n));
        ActualizarNecesidadRequest dto = new ActualizarNecesidadRequest();
        dto.setEstado(EstadoNecesidad.VENCIDA);
        dto.setFechaVencimiento(HOY.minusDays(1));

        assertThat(service.actualizar(10L, dto, 1L).estado()).isEqualTo("VENCIDA");
    }

    // --- crear ---

    @Test
    void crear_pastFechaVencimiento_badRequest() {
        CrearNecesidadRequest dto = new CrearNecesidadRequest(
                "d", PrioridadNecesidad.MEDIA, HOY.minusDays(1), 1L, List.of(1L));

        expectStatus(() -> service.crear(dto, 1L), HttpStatus.BAD_REQUEST, "FECHA_VENCIMIENTO_PASADA");
        verify(necesidadRepository, never()).save(any());
    }

    @Test
    void crear_todayFechaVencimiento_isAllowed() {
        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(org));
        CrearNecesidadRequest dto = new CrearNecesidadRequest(
                "d", PrioridadNecesidad.MEDIA, HOY, 1L, List.of(1L));

        assertThat(service.crear(dto, 1L).fechaPublicacion()).isEqualTo(HOY);
    }

    // --- listings ---

    @Test
    void findAll_excludesVencida() {
        Page<Necesidad> page = new PageImpl<>(List.of(necesidad(EstadoNecesidad.ABIERTA, HOY.plusDays(3))), pageable, 1);
        when(necesidadRepository.findByEstadoNot(EstadoNecesidad.VENCIDA, pageable)).thenReturn(page);

        assertThat(service.findAll(pageable).getContent()).hasSize(1);
        verify(necesidadRepository, never()).findAll(any(Pageable.class));
    }

    @Test
    void findByOrganizacion_anonymous_excludesVencida() {
        when(necesidadRepository.findByOrganizacion_IdAndEstadoNot(1L, EstadoNecesidad.VENCIDA, pageable))
                .thenReturn(new PageImpl<>(List.of(), pageable, 0));

        assertThat(service.findByOrganizacion(1L, pageable).getContent()).isEmpty();
        verify(necesidadRepository, never()).findByOrganizacion_Id(anyLong(), any(Pageable.class));
    }

    @Test
    void findByOrganizacion_owningReferente_includesVencida() {
        login(1L, "ROLE_REFERENTE");
        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(org));
        when(necesidadRepository.findByOrganizacion_Id(1L, pageable)).thenReturn(
                new PageImpl<>(List.of(necesidad(EstadoNecesidad.VENCIDA, HOY.minusDays(1))), pageable, 1));

        assertThat(service.findByOrganizacion(1L, pageable).getContent()).hasSize(1);
    }

    @Test
    void findByOrganizacion_otherReferente_excludesVencida() {
        login(2L, "ROLE_REFERENTE");
        when(organizacionRepository.findByIdAndReferente_Id(1L, 2L)).thenReturn(Optional.empty());
        when(necesidadRepository.findByOrganizacion_IdAndEstadoNot(1L, EstadoNecesidad.VENCIDA, pageable))
                .thenReturn(new PageImpl<>(List.of(), pageable, 0));

        assertThat(service.findByOrganizacion(1L, pageable).getContent()).isEmpty();
    }

    @Test
    void findByOrganizacion_admin_includesVencida() {
        login(5L, "ROLE_ADMINISTRADOR");
        when(necesidadRepository.findByOrganizacion_Id(1L, pageable))
                .thenReturn(new PageImpl<>(List.of(), pageable, 0));

        service.findByOrganizacion(1L, pageable);
        verify(necesidadRepository).findByOrganizacion_Id(1L, pageable);
    }


    @Test
    void relanzar_recordsEstadoChangeInSameTransaction() {
        Necesidad n = necesidad(EstadoNecesidad.VENCIDA, HOY.minusDays(1));
        when(necesidadRepository.findById(10L)).thenReturn(Optional.of(n));

        service.relanzar(10L, new RelanzarNecesidadRequest(HOY.plusDays(7)), 1L);

        ArgumentCaptor<ActividadService.Registro> captor =
                ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService).registrar(captor.capture());
        assertThat(captor.getValue().accion()).isEqualTo(TipoActividad.NECESIDAD_RELANZADA);
        assertThat(captor.getValue().entidadTipo()).isEqualTo("NECESIDAD");
        assertThat(captor.getValue().antes()).isEqualTo("VENCIDA");
        assertThat(captor.getValue().despues()).isEqualTo("ABIERTA");
    }
}
