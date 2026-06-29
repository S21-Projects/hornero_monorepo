package org.example.organizacion;

import org.example.domain.EstadoOrganizacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.TipoOrganizacion;
import org.example.organizacion.dto.CrearOrganizacionRequest;
import org.example.organizacion.dto.OrganizacionResponse;
import org.example.user.Administrador;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
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
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrganizacionServiceTest {

    @Mock
    private OrganizacionRepository organizacionRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @InjectMocks
    private OrganizacionService organizacionService;

    private Referente referente;
    private Administrador administrador;
    private Pageable defaultPageable;

    @BeforeEach
    void setUp() {
        referente = new Referente(1L, "Ref Test", "ref@test.com", "encoded", true);
        administrador = new Administrador(2L, "Admin Test", "admin@test.com", "encoded", true);
        defaultPageable = PageRequest.of(0, 20);
    }

    // --- crear ---

    @Test
    void crear_setsValidadaFalseAndReferente() {
        CrearOrganizacionRequest request = new CrearOrganizacionRequest(
                "Org Test", TipoOrganizacion.COMEDOR, "Una descripcion", "Calle 123", -34.0, -58.0);

        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(referente));
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> {
            Organizacion org = inv.getArgument(0);
            org.setId(10L);
            return org;
        });

        OrganizacionResponse response = organizacionService.crear(request, 1L);

        assertThat(response.isValidada()).isFalse();
        assertThat(response.getReferenteEmail()).isEqualTo("ref@test.com");
        assertThat(response.getNombre()).isEqualTo("Org Test");
        verify(organizacionRepository).save(any(Organizacion.class));
    }

    @Test
    void crear_throwsForbiddenWhenUserIsNotReferente() {
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(administrador));

        CrearOrganizacionRequest request = new CrearOrganizacionRequest(
                "Org", TipoOrganizacion.COMEDOR, null, null, -34.0, -58.0);

        assertThatThrownBy(() -> organizacionService.crear(request, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void crear_throwsUnauthorizedWhenUserNotFound() {
        when(usuarioRepository.findById(99L)).thenReturn(Optional.empty());

        CrearOrganizacionRequest request = new CrearOrganizacionRequest(
                "Org", TipoOrganizacion.COMEDOR, null, null, -34.0, -58.0);

        assertThatThrownBy(() -> organizacionService.crear(request, 99L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("401");
    }

    // --- validar ---

    @Test
    void validar_setsValidadaTrueAndValidadoPor() {
        Organizacion org = new Organizacion();
        org.setId(5L);
        org.setNombre("Org");
        org.setEstado(EstadoOrganizacion.PENDIENTE);
        org.setReferente(referente);

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(administrador));
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> inv.getArgument(0));

        OrganizacionResponse response = organizacionService.validar(5L, 2L);

        assertThat(response.isValidada()).isTrue();
        assertThat(response.getValidadoPorNombre()).isEqualTo("Admin Test");
    }

    @Test
    void validar_throwsConflictWhenAlreadyValidated() {
        Organizacion org = new Organizacion();
        org.setId(5L);
        org.setEstado(EstadoOrganizacion.APROBADA);

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));

        assertThatThrownBy(() -> organizacionService.validar(5L, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
    }

    @Test
    void validar_throwsNotFoundWhenOrgMissing() {
        when(organizacionRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> organizacionService.validar(999L, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404");
    }

    // --- listarValidadas / listarPendientes ---

    @Test
    void listarValidadas_returnsOnlyValidated() {
        Organizacion validated = new Organizacion();
        validated.setId(1L);
        validated.setNombre("Validada");
        validated.setEstado(EstadoOrganizacion.APROBADA);
        validated.setReferente(referente);

        Page<Organizacion> repoPage = new PageImpl<>(List.of(validated), defaultPageable, 1L);
        when(organizacionRepository.findByEstado(EstadoOrganizacion.APROBADA, defaultPageable)).thenReturn(repoPage);

        Page<OrganizacionResponse> result = organizacionService.listarValidadas(defaultPageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).isValidada()).isTrue();
    }

    @Test
    void listarPendientes_returnsOnlyPending() {
        Organizacion pending = new Organizacion();
        pending.setId(2L);
        pending.setNombre("Pendiente");
        pending.setEstado(EstadoOrganizacion.PENDIENTE);
        pending.setReferente(referente);

        Page<Organizacion> repoPage = new PageImpl<>(List.of(pending), defaultPageable, 1L);
        when(organizacionRepository.findByEstado(EstadoOrganizacion.PENDIENTE, defaultPageable)).thenReturn(repoPage);

        Page<OrganizacionResponse> result = organizacionService.listarPendientes(defaultPageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).isValidada()).isFalse();
    }

    @Test
    void listarPendientes_doesNotReturnValidatedOrgs() {
        Page<Organizacion> emptyPage = new PageImpl<>(List.of(), defaultPageable, 0L);
        when(organizacionRepository.findByEstado(EstadoOrganizacion.PENDIENTE, defaultPageable)).thenReturn(emptyPage);

        Page<OrganizacionResponse> result = organizacionService.listarPendientes(defaultPageable);

        assertThat(result.getContent()).isEmpty();
    }

    // --- findByReferente ---

    @Test
    void findByReferente_returnsOrganizacionForReferente() {
        Organizacion org = new Organizacion();
        org.setId(7L);
        org.setNombre("Comedor Test");
        org.setEstado(EstadoOrganizacion.PENDIENTE);
        org.setReferente(referente);

        when(organizacionRepository.findByReferente_Id(1L)).thenReturn(java.util.Optional.of(org));

        OrganizacionResponse response = organizacionService.findByReferente(1L);

        assertThat(response.getId()).isEqualTo(7L);
        assertThat(response.getNombre()).isEqualTo("Comedor Test");
        assertThat(response.isValidada()).isFalse();
        assertThat(response.getReferenteEmail()).isEqualTo("ref@test.com");
    }

    @Test
    void findByReferente_throws404WhenNoOrgFound() {
        when(organizacionRepository.findByReferente_Id(99L)).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> organizacionService.findByReferente(99L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404");
    }

    @Test
    void findByReferente_returnsValidatedOrgToo() {
        Organizacion org = new Organizacion();
        org.setId(8L);
        org.setNombre("Org Validada");
        org.setEstado(EstadoOrganizacion.APROBADA);
        org.setReferente(referente);

        when(organizacionRepository.findByReferente_Id(1L)).thenReturn(java.util.Optional.of(org));

        OrganizacionResponse response = organizacionService.findByReferente(1L);

        assertThat(response.isValidada()).isTrue();
    }

    @Test
    void crear_throwsForbiddenWhenUserIsDonante() {
        Donante donante = new Donante(3L, "Donante", "don@test.com", "encoded", true);
        when(usuarioRepository.findById(3L)).thenReturn(Optional.of(donante));

        CrearOrganizacionRequest request = new CrearOrganizacionRequest(
                "Org", TipoOrganizacion.COMEDOR, null, null, -34.0, -58.0);

        assertThatThrownBy(() -> organizacionService.crear(request, 3L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    // --- findBySlug ---

    @Test
    void findBySlug_validatedOrg_returnsOrgForAnyUser() {
        Organizacion org = new Organizacion();
        org.setId(10L);
        org.setNombre("Comedor Validado");
        org.setSlug("comedor-validado");
        org.setEstado(EstadoOrganizacion.APROBADA);
        org.setReferente(referente);

        when(organizacionRepository.findBySlug("comedor-validado")).thenReturn(Optional.of(org));

        OrganizacionResponse response = organizacionService.findBySlug("comedor-validado", 99L, "ROLE_DONANTE");

        assertThat(response.getId()).isEqualTo(10L);
        assertThat(response.isValidada()).isTrue();
    }

    @Test
    void findBySlug_nonValidatedOrg_wrongRole_throwsForbidden() {
        Organizacion org = new Organizacion();
        org.setId(11L);
        org.setNombre("Pendiente");
        org.setSlug("pendiente");
        org.setEstado(EstadoOrganizacion.PENDIENTE);
        org.setReferente(referente); // referente.id = 1L

        when(organizacionRepository.findBySlug("pendiente")).thenReturn(Optional.of(org));

        assertThatThrownBy(() -> organizacionService.findBySlug("pendiente", 99L, "ROLE_DONANTE"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void findBySlug_nonValidatedOrg_administrador_returnsOrg() {
        Organizacion org = new Organizacion();
        org.setId(12L);
        org.setNombre("Pendiente Admin");
        org.setSlug("pendiente-admin");
        org.setEstado(EstadoOrganizacion.PENDIENTE);
        org.setReferente(referente);

        when(organizacionRepository.findBySlug("pendiente-admin")).thenReturn(Optional.of(org));

        OrganizacionResponse response = organizacionService.findBySlug("pendiente-admin", 2L, "ROLE_ADMINISTRADOR");

        assertThat(response.getId()).isEqualTo(12L);
        assertThat(response.isValidada()).isFalse();
    }

    @Test
    void findBySlug_nonValidatedOrg_owningReferente_returnsOrg() {
        Organizacion org = new Organizacion();
        org.setId(13L);
        org.setNombre("Mi Org");
        org.setSlug("mi-org");
        org.setEstado(EstadoOrganizacion.PENDIENTE);
        org.setReferente(referente); // referente.id = 1L

        when(organizacionRepository.findBySlug("mi-org")).thenReturn(Optional.of(org));

        OrganizacionResponse response = organizacionService.findBySlug("mi-org", 1L, "ROLE_REFERENTE");

        assertThat(response.getId()).isEqualTo(13L);
    }

    @Test
    void findBySlug_orgNotFound_throws404() {
        when(organizacionRepository.findBySlug("no-existe")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> organizacionService.findBySlug("no-existe", 1L, "ROLE_REFERENTE"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404");
    }
}
