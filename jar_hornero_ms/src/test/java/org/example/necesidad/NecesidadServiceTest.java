package org.example.necesidad;

import org.example.actividad.ActividadService;
import org.example.auth.VerificacionService;
import org.example.config.AcreditacionProperties;
import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.EstadoNecesidad;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.example.domain.UnidadArticulo;
import org.example.necesidad.dto.ActualizarNecesidadRequest;
import org.example.necesidad.dto.CrearNecesidadRequest;
import org.example.user.Referente;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NecesidadServiceTest {

    @Mock
    private NecesidadRepository necesidadRepository;

    @Mock
    private OrganizacionRepository organizacionRepository;

    @Mock
    private VerificacionService verificacionService;

    @Mock
    private AcreditacionProperties acreditacionProperties;

    @Mock
    private ArticuloRepository articuloRepository;

    @org.mockito.Spy
    private java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("America/Argentina/Buenos_Aires"));

    @Mock
    private ActividadService actividadService;

    @Mock
    private org.example.domain.AsignacionRepository asignacionRepository;

    @Mock
    private org.example.domain.DonacionRepository donacionRepository;

    @InjectMocks
    private NecesidadService necesidadService;

    private Organizacion organizacion;
    private Referente referente;
    private Pageable defaultPageable;

    @BeforeEach
    void setUp() {
        referente = new Referente(1L, "Ref Test", "ref@test.com", "encoded", true);

        organizacion = new Organizacion();
        organizacion.setId(1L);
        organizacion.setNombre("Org Test");
        organizacion.setEstado(EstadoOrganizacion.APROBADA);
        // AD-6: APROBADA <=> nivel >= N1 — an APROBADA fixture must carry a matching nivel now
        // that the concurrency cap (N0 = 0) reads it.
        organizacion.setNivel(NivelAcreditacion.N1);
        organizacion.setReferente(referente);
        defaultPageable = PageRequest.of(0, 20);

        // Feature catalogo-articulos, decision 6: crear() now always resolves articuloIds — a
        // single active NO_PERECEDERO articulo (fits N1) covers every `crear` test below.
        Articulo articulo = new Articulo();
        articulo.setId(1L);
        articulo.setNombre("Arroz");
        articulo.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        articulo.setUnidad(UnidadArticulo.KG);
        articulo.setActivo(true);
        org.mockito.Mockito.lenient().when(articuloRepository.findById(1L)).thenReturn(Optional.of(articulo));
    }

    private Necesidad buildNecesidad(Long id) {
        Necesidad n = new Necesidad();
        n.setId(id);
        n.setDescripcion("Descripcion " + id);
        n.setPrioridad(PrioridadNecesidad.MEDIA);
        n.setEstado(EstadoNecesidad.ABIERTA);
        n.setFechaPublicacion(LocalDate.now());
        n.setFechaVencimiento(LocalDate.now().plusDays(30));
        n.setOrganizacion(organizacion);
        return n;
    }

    // --- findById — N17: necesidades of an N0 organization are hidden from non-owners ---

    @org.junit.jupiter.api.AfterEach
    void clearSecurityContext() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }

    private void authenticate(Long userId, String role) {
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        userId, null,
                        List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority(role))));
    }

    @Test
    void findById_n0Organization_anonymous_throwsNotFound() {
        organizacion.setNivel(NivelAcreditacion.N0);
        when(necesidadRepository.findById(1L)).thenReturn(Optional.of(buildNecesidad(1L)));

        assertThatThrownBy(() -> necesidadService.findById(1L))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void findById_nullNivelOrganization_anonymous_throwsNotFound() {
        organizacion.setNivel(null);
        when(necesidadRepository.findById(1L)).thenReturn(Optional.of(buildNecesidad(1L)));

        assertThatThrownBy(() -> necesidadService.findById(1L))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void findById_n0Organization_otherUser_throwsNotFound() {
        organizacion.setNivel(NivelAcreditacion.N0);
        authenticate(99L, "ROLE_DONANTE");
        when(necesidadRepository.findById(1L)).thenReturn(Optional.of(buildNecesidad(1L)));

        assertThatThrownBy(() -> necesidadService.findById(1L))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void findById_n0Organization_owningReferente_returnsNecesidad() {
        organizacion.setNivel(NivelAcreditacion.N0);
        authenticate(1L, "ROLE_REFERENTE");
        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(organizacion));
        when(necesidadRepository.findById(1L)).thenReturn(Optional.of(buildNecesidad(1L)));

        assertThat(necesidadService.findById(1L).id()).isEqualTo(1L);
    }

    @Test
    void findById_n0Organization_admin_returnsNecesidad() {
        organizacion.setNivel(NivelAcreditacion.N0);
        authenticate(500L, "ROLE_ADMINISTRADOR");
        when(necesidadRepository.findById(1L)).thenReturn(Optional.of(buildNecesidad(1L)));

        assertThat(necesidadService.findById(1L).id()).isEqualTo(1L);
    }

    @Test
    void findById_n1Organization_anonymous_returnsNecesidad() {
        when(necesidadRepository.findById(1L)).thenReturn(Optional.of(buildNecesidad(1L)));

        assertThat(necesidadService.findById(1L).id()).isEqualTo(1L);
    }

    // --- findByOrganizacion ---

    @Test
    void findByOrganizacion_repoReturnsTwoResults_returnsListOfTwo() {
        List<Necesidad> content = List.of(buildNecesidad(1L), buildNecesidad(2L));
        Page<Necesidad> repoPage = new PageImpl<>(content, defaultPageable, 2L);

        when(necesidadRepository.findByOrganizacion_IdAndEstadoNot(1L, EstadoNecesidad.VENCIDA, defaultPageable)).thenReturn(repoPage);

        Page<NecesidadResponse> result = necesidadService.findByOrganizacion(1L, defaultPageable);

        assertThat(result.getContent()).hasSize(2);
        assertThat(result.getContent().get(0).organizacionId()).isEqualTo(1L);
        assertThat(result.getContent().get(1).organizacionId()).isEqualTo(1L);
    }

    @Test
    void findByOrganizacion_repoReturnsEmpty_returnsEmptyPage() {
        Page<Necesidad> emptyPage = new PageImpl<>(List.of(), defaultPageable, 0L);
        when(necesidadRepository.findByOrganizacion_IdAndEstadoNot(99L, EstadoNecesidad.VENCIDA, defaultPageable)).thenReturn(emptyPage);

        Page<NecesidadResponse> result = necesidadService.findByOrganizacion(99L, defaultPageable);

        assertThat(result).isNotNull();
        assertThat(result.getContent()).isEmpty();
        assertThat(result.getTotalElements()).isEqualTo(0L);
    }

    // --- findAll ---

    @Test
    void findAll_repoReturnsThreeResults_returnsPageOfThree() {
        List<Necesidad> content = List.of(buildNecesidad(1L), buildNecesidad(2L), buildNecesidad(3L));
        Page<Necesidad> repoPage = new PageImpl<>(content, defaultPageable, 3L);

        when(necesidadRepository.findPublicas(null, defaultPageable)).thenReturn(repoPage);

        Page<NecesidadResponse> result = necesidadService.findAll(defaultPageable);

        assertThat(result.getContent()).hasSize(3);
    }

    @Test
    void findAll_repoReturnsEmpty_returnsEmptyPage() {
        Page<Necesidad> emptyPage = new PageImpl<>(List.of(), defaultPageable, 0L);
        when(necesidadRepository.findPublicas(null, defaultPageable)).thenReturn(emptyPage);

        Page<NecesidadResponse> result = necesidadService.findAll(defaultPageable);

        assertThat(result).isNotNull();
        assertThat(result.getContent()).isEmpty();
    }

    // --- crear ---

    @Test
    void crear_foreignOrganizacionId_throwsForbidden() {
        CrearNecesidadRequest dto = new CrearNecesidadRequest(
                "Descripcion", PrioridadNecesidad.MEDIA, LocalDate.now().plusDays(10), 99L, List.of(1L));

        when(organizacionRepository.findByIdAndReferente_Id(99L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> necesidadService.crear(dto, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void crear_ownedOrganizacionId_succeeds() {
        CrearNecesidadRequest dto = new CrearNecesidadRequest(
                "Descripcion", PrioridadNecesidad.MEDIA, LocalDate.now().plusDays(10), 1L, List.of(1L));

        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(organizacion));
        when(acreditacionProperties.capPara(NivelAcreditacion.N1)).thenReturn(3L);
        when(necesidadRepository.save(org.mockito.ArgumentMatchers.any(Necesidad.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        NecesidadResponse response = necesidadService.crear(dto, 1L);

        assertThat(response.organizacionId()).isEqualTo(1L);
        verify(verificacionService).requireVerified(1L);
    }

    @Test
    void crear_unverifiedEmail_throwsForbiddenBeforeTouchingOrganizacion() {
        CrearNecesidadRequest dto = new CrearNecesidadRequest(
                "Descripcion", PrioridadNecesidad.MEDIA, LocalDate.now().plusDays(10), 1L, List.of(1L));

        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "EMAIL_NO_VERIFICADO"))
                .when(verificacionService).requireVerified(1L);

        assertThatThrownBy(() -> necesidadService.crear(dto, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("EMAIL_NO_VERIFICADO");

        org.mockito.Mockito.verifyNoInteractions(organizacionRepository);
    }

    // --- crear — catalogo-articulos (decision 6) ---

    @Test
    void crear_sinArticulos_throwsBadRequest() {
        CrearNecesidadRequest dto = new CrearNecesidadRequest(
                "Descripcion", PrioridadNecesidad.MEDIA, LocalDate.now().plusDays(10), 1L, List.of());

        assertThatThrownBy(() -> necesidadService.crear(dto, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");

        org.mockito.Mockito.verifyNoInteractions(organizacionRepository);
    }

    @Test
    void crear_articuloInactivo_throwsBadRequest() {
        CrearNecesidadRequest dto = new CrearNecesidadRequest(
                "Descripcion", PrioridadNecesidad.MEDIA, LocalDate.now().plusDays(10), 1L, List.of(2L));

        Articulo inactivo = new Articulo();
        inactivo.setId(2L);
        inactivo.setNombre("Leche");
        inactivo.setCategoria(CategoriaAlimento.REFRIGERADO);
        inactivo.setUnidad(UnidadArticulo.LITRO);
        inactivo.setActivo(false);

        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(organizacion));
        when(acreditacionProperties.capPara(NivelAcreditacion.N1)).thenReturn(3L);
        when(articuloRepository.findById(2L)).thenReturn(Optional.of(inactivo));

        assertThatThrownBy(() -> necesidadService.crear(dto, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void crear_articuloDesconocido_throwsBadRequest() {
        CrearNecesidadRequest dto = new CrearNecesidadRequest(
                "Descripcion", PrioridadNecesidad.MEDIA, LocalDate.now().plusDays(10), 1L, List.of(999L));

        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(organizacion));
        when(acreditacionProperties.capPara(NivelAcreditacion.N1)).thenReturn(3L);
        when(articuloRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> necesidadService.crear(dto, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void crear_derivaCategoriaDelArticuloSeleccionado() {
        CrearNecesidadRequest dto = new CrearNecesidadRequest(
                "Descripcion", PrioridadNecesidad.MEDIA, LocalDate.now().plusDays(10), 1L, List.of(1L));

        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(organizacion));
        when(acreditacionProperties.capPara(NivelAcreditacion.N1)).thenReturn(3L);
        when(necesidadRepository.save(org.mockito.ArgumentMatchers.any(Necesidad.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        NecesidadResponse response = necesidadService.crear(dto, 1L);

        assertThat(response.categoria()).isEqualTo(CategoriaAlimento.NO_PERECEDERO);
        assertThat(response.articulos()).hasSize(1);
        assertThat(response.articulos().get(0).id()).isEqualTo(1L);
    }

    // --- actualizar — catalogo-articulos (decision 6) ---

    @Test
    void actualizar_articuloIdsVacio_throwsBadRequest() {
        Necesidad n = buildNecesidad(1L);
        when(necesidadRepository.findById(1L)).thenReturn(Optional.of(n));

        var dto = new ActualizarNecesidadRequest();
        dto.setArticuloIds(List.of());

        assertThatThrownBy(() -> necesidadService.actualizar(1L, dto, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void actualizar_articuloInactivo_throwsBadRequest() {
        Necesidad n = buildNecesidad(1L);
        when(necesidadRepository.findById(1L)).thenReturn(Optional.of(n));

        Articulo inactivo = new Articulo();
        inactivo.setId(2L);
        inactivo.setCategoria(CategoriaAlimento.REFRIGERADO);
        inactivo.setActivo(false);
        when(articuloRepository.findById(2L)).thenReturn(Optional.of(inactivo));

        var dto = new ActualizarNecesidadRequest();
        dto.setArticuloIds(List.of(2L));

        assertThatThrownBy(() -> necesidadService.actualizar(1L, dto, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    // --- checkOwnership via actualizar ---

    @Test
    void actualizar_organizacionWithNullReferente_throwsForbidden() {
        organizacion.setReferente(null);
        Necesidad n = buildNecesidad(1L);

        when(necesidadRepository.findById(1L)).thenReturn(Optional.of(n));

        assertThatThrownBy(() -> necesidadService.actualizar(1L, new org.example.necesidad.dto.ActualizarNecesidadRequest(), 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    // --- eliminar — a necesidad already referenced by asignaciones/donaciones cannot be deleted ---

    @Test
    void eliminar_withDonaciones_throwsConflict() {
        when(necesidadRepository.findById(1L)).thenReturn(Optional.of(buildNecesidad(1L)));
        when(asignacionRepository.existsByNecesidad_Id(1L)).thenReturn(false);
        when(donacionRepository.existsByNecesidad_Id(1L)).thenReturn(true);

        assertThatThrownBy(() -> necesidadService.eliminar(1L, 1L))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getReason()).startsWith("NECESIDAD_CON_DONACIONES");
                });
        org.mockito.Mockito.verify(necesidadRepository, org.mockito.Mockito.never()).delete(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void eliminar_withAsignaciones_throwsConflict() {
        when(necesidadRepository.findById(1L)).thenReturn(Optional.of(buildNecesidad(1L)));
        when(asignacionRepository.existsByNecesidad_Id(1L)).thenReturn(true);

        assertThatThrownBy(() -> necesidadService.eliminar(1L, 1L))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void eliminar_withoutReferences_deletes() {
        Necesidad n = buildNecesidad(1L);
        when(necesidadRepository.findById(1L)).thenReturn(Optional.of(n));
        when(asignacionRepository.existsByNecesidad_Id(1L)).thenReturn(false);
        when(donacionRepository.existsByNecesidad_Id(1L)).thenReturn(false);

        necesidadService.eliminar(1L, 1L);

        verify(necesidadRepository).delete(n);
    }
}
