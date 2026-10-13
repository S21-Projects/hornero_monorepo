package org.example.organizacion;

import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.mockito.ArgumentMatchers;
import org.example.actividad.TipoActividad;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.example.actividad.ActividadService;
import org.example.acreditacion.AcreditacionService;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
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

    @Mock
    private AcreditacionService acreditacionService;

    @Mock
    private ActividadService actividadService;

    @Mock
    private org.springframework.context.ApplicationEventPublisher eventPublisher;

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
                "Org Test", TipoOrganizacion.COMEDOR, "Una descripcion", "Calle 123", -34.0, -58.0,
                null, null, null);

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
    void crear_appendsSuffixWhenSlugAlreadyExists() {
        CrearOrganizacionRequest request = new CrearOrganizacionRequest(
                "Org Test", TipoOrganizacion.COMEDOR, "d", "Calle 123", -34.0, -58.0, null, null, null);
        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(referente));
        when(organizacionRepository.existsBySlug("org-test")).thenReturn(true);
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> inv.getArgument(0));

        OrganizacionResponse response = organizacionService.crear(request, 1L);

        assertThat(response.getSlug()).isEqualTo("org-test-2");
    }

    @Test
    void crear_keepsCountingUntilSlugIsFree() {
        CrearOrganizacionRequest request = new CrearOrganizacionRequest(
                "Org Test", TipoOrganizacion.COMEDOR, "d", "Calle 123", -34.0, -58.0, null, null, null);
        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(referente));
        when(organizacionRepository.existsBySlug("org-test")).thenReturn(true);
        when(organizacionRepository.existsBySlug("org-test-2")).thenReturn(true);
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> inv.getArgument(0));

        OrganizacionResponse response = organizacionService.crear(request, 1L);

        assertThat(response.getSlug()).isEqualTo("org-test-3");
    }

    @Test
    void crear_throwsForbiddenWhenUserIsNotReferente() {
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(administrador));

        CrearOrganizacionRequest request = new CrearOrganizacionRequest(
                "Org", TipoOrganizacion.COMEDOR, null, null, -34.0, -58.0,
                null, null, null);

        assertThatThrownBy(() -> organizacionService.crear(request, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void crear_throwsUnauthorizedWhenUserNotFound() {
        when(usuarioRepository.findById(99L)).thenReturn(Optional.empty());

        CrearOrganizacionRequest request = new CrearOrganizacionRequest(
                "Org", TipoOrganizacion.COMEDOR, null, null, -34.0, -58.0,
                null, null, null);

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
        // AD-6: validar() now delegates the nivel/estado write to AcreditacionService; this stub
        // simulates aplicarTransicionLegacy's real mutation (proven for real by
        // OrganizacionServiceValidarRechazarTest's H2-backed integration test).
        doAnswer(inv -> {
            Organizacion target = inv.getArgument(0);
            target.setNivel(NivelAcreditacion.N1);
            target.setEstado(EstadoOrganizacion.APROBADA);
            target.setValidada(true);
            return null;
        }).when(acreditacionService).aplicarTransicionLegacy(eq(org), eq(NivelAcreditacion.N1), eq(administrador), any(), any());

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

    // --- listarPorReferente ---

    @Test
    void listarPorReferente_returnsAllOrganizacionesForReferente() {
        Organizacion org1 = new Organizacion();
        org1.setId(7L);
        org1.setNombre("Comedor Test");
        org1.setEstado(EstadoOrganizacion.PENDIENTE);
        org1.setReferente(referente);

        Organizacion org2 = new Organizacion();
        org2.setId(8L);
        org2.setNombre("Org Validada");
        org2.setEstado(EstadoOrganizacion.APROBADA);
        org2.setReferente(referente);

        when(organizacionRepository.findByReferente_Id(1L)).thenReturn(List.of(org1, org2));

        List<OrganizacionResponse> response = organizacionService.listarPorReferente(1L);

        assertThat(response).hasSize(2);
        assertThat(response.get(0).getReferenteEmail()).isEqualTo("ref@test.com");
        assertThat(response.get(1).isValidada()).isTrue();
    }

    @Test
    void listarPorReferente_noOrgs_returnsEmptyListNeverThrows() {
        when(organizacionRepository.findByReferente_Id(99L)).thenReturn(List.of());

        List<OrganizacionResponse> response = organizacionService.listarPorReferente(99L);

        assertThat(response).isEmpty();
    }

    // --- crear: cap enforcement ---

    @Test
    void crear_underCap_succeeds() {
        CrearOrganizacionRequest request = new CrearOrganizacionRequest(
                "Org Test", TipoOrganizacion.COMEDOR, "Una descripcion", "Calle 123", -34.0, -58.0,
                null, null, null);

        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(referente));
        when(organizacionRepository.countByReferente_IdAndEstadoNot(1L, EstadoOrganizacion.RECHAZADA)).thenReturn(2L);
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> inv.getArgument(0));

        OrganizacionResponse response = organizacionService.crear(request, 1L);

        assertThat(response.getNombre()).isEqualTo("Org Test");
    }

    @Test
    void crear_atCap_throwsConflict() {
        CrearOrganizacionRequest request = new CrearOrganizacionRequest(
                "Org Test", TipoOrganizacion.COMEDOR, "Una descripcion", "Calle 123", -34.0, -58.0,
                null, null, null);

        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(referente));
        when(organizacionRepository.countByReferente_IdAndEstadoNot(1L, EstadoOrganizacion.RECHAZADA)).thenReturn(3L);

        assertThatThrownBy(() -> organizacionService.crear(request, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");

        verify(organizacionRepository, never()).save(any());
    }

    // --- asignarReferente ---

    @Test
    void asignarReferente_nullId_unassignsOrg() {
        Organizacion org = new Organizacion();
        org.setId(5L);
        org.setReferente(referente);

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> inv.getArgument(0));

        OrganizacionResponse response = organizacionService.asignarReferente(
                5L, new org.example.organizacion.dto.AsignarReferenteRequest(null));

        assertThat(response.getReferenteId()).isNull();
    }

    @Test
    void asignarReferente_validReferente_assignsOrg() {
        Referente target = new Referente(3L, "Otro Ref", "otro@test.com", "encoded", true);
        Organizacion org = new Organizacion();
        org.setId(5L);

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));
        when(usuarioRepository.findById(3L)).thenReturn(Optional.of(target));
        when(organizacionRepository.countByReferente_IdAndEstadoNot(3L, EstadoOrganizacion.RECHAZADA)).thenReturn(0L);
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> inv.getArgument(0));

        OrganizacionResponse response = organizacionService.asignarReferente(
                5L, new org.example.organizacion.dto.AsignarReferenteRequest(3L));

        assertThat(response.getReferenteId()).isEqualTo(3L);
    }

    @Test
    void asignarReferente_targetUserNotFound_throws404() {
        Organizacion org = new Organizacion();
        org.setId(5L);

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));
        when(usuarioRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> organizacionService.asignarReferente(
                5L, new org.example.organizacion.dto.AsignarReferenteRequest(999L)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404");
    }

    @Test
    void asignarReferente_targetNotReferente_throws400() {
        Organizacion org = new Organizacion();
        org.setId(5L);

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(administrador));

        assertThatThrownBy(() -> organizacionService.asignarReferente(
                5L, new org.example.organizacion.dto.AsignarReferenteRequest(2L)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void asignarReferente_targetInactive_throws409() {
        Referente inactivo = new Referente(4L, "Inactivo", "inactivo@test.com", "encoded", false);
        Organizacion org = new Organizacion();
        org.setId(5L);

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));
        when(usuarioRepository.findById(4L)).thenReturn(Optional.of(inactivo));

        assertThatThrownBy(() -> organizacionService.asignarReferente(
                5L, new org.example.organizacion.dto.AsignarReferenteRequest(4L)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
    }

    @Test
    void asignarReferente_targetOverCap_throws409() {
        Organizacion org = new Organizacion();
        org.setId(5L);

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));
        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(referente));
        when(organizacionRepository.countByReferente_IdAndEstadoNot(1L, EstadoOrganizacion.RECHAZADA)).thenReturn(3L);

        assertThatThrownBy(() -> organizacionService.asignarReferente(
                5L, new org.example.organizacion.dto.AsignarReferenteRequest(1L)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
    }

    @Test
    void crear_throwsForbiddenWhenUserIsDonante() {
        Donante donante = new Donante(3L, "Donante", "don@test.com", "encoded", true);
        when(usuarioRepository.findById(3L)).thenReturn(Optional.of(donante));

        CrearOrganizacionRequest request = new CrearOrganizacionRequest(
                "Org", TipoOrganizacion.COMEDOR, null, null, -34.0, -58.0,
                null, null, null);

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

    // --- actualizar: info pública pending snapshot (D1/D2) ---

    @Test
    void actualizar_referenteSubmitsInfoPublica_seedsSnapshotAndLeavesLiveUntouched() {
        Organizacion org = new Organizacion();
        org.setId(5L);
        org.setReferente(referente);
        org.setAceptaDonaciones(false);
        org.setSitioWebUrl("https://old.org");

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> inv.getArgument(0));

        org.example.organizacion.dto.ActualizarOrganizacionRequest request =
                new org.example.organizacion.dto.ActualizarOrganizacionRequest();
        request.setSitioWebUrl("https://new.org");

        OrganizacionResponse response = organizacionService.actualizar(5L, request, 1L);

        // live untouched
        assertThat(org.getSitioWebUrl()).isEqualTo("https://old.org");
        // pending snapshot captured the rest of the live state + the new value
        assertThat(org.getSitioWebUrlPendiente()).isEqualTo("https://new.org");
        assertThat(org.getAceptaDonacionesPendiente()).isFalse();
        assertThat(org.getInfoPublicaPendienteEn()).isNotNull();
        assertThat(response.getInfoPublicaPendienteEn()).isNotNull();
    }

    @Test
    void actualizar_secondSubmission_doesNotReseedFromStalePending() {
        Organizacion org = new Organizacion();
        org.setId(5L);
        org.setReferente(referente);
        org.setSitioWebUrl("https://live.org");
        org.setSitioWebUrlPendiente("https://first-pending.org");
        org.setInfoPublicaPendienteEn(java.time.LocalDateTime.now().minusMinutes(5));

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> inv.getArgument(0));

        org.example.organizacion.dto.ActualizarOrganizacionRequest request =
                new org.example.organizacion.dto.ActualizarOrganizacionRequest();
        request.setDonacionDirectaUrl("https://mp.example.org");

        organizacionService.actualizar(5L, request, 1L);

        // snapshot NOT reseeded from live (idempotent) — prior pending sitioWebUrl kept
        assertThat(org.getSitioWebUrlPendiente()).isEqualTo("https://first-pending.org");
        assertThat(org.getDonacionDirectaUrlPendiente()).isEqualTo("https://mp.example.org");
    }

    @Test
    void actualizar_emptyStringClearsPendingToNull() {
        Organizacion org = new Organizacion();
        org.setId(5L);
        org.setReferente(referente);
        org.setSitioWebUrl("https://live.org");

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> inv.getArgument(0));

        org.example.organizacion.dto.ActualizarOrganizacionRequest request =
                new org.example.organizacion.dto.ActualizarOrganizacionRequest();
        request.setSitioWebUrl("");

        organizacionService.actualizar(5L, request, 1L);

        assertThat(org.getSitioWebUrlPendiente()).isNull();
        assertThat(org.getInfoPublicaPendienteEn()).isNotNull();
    }

    @Test
    void actualizar_notOwner_throwsForbidden() {
        Organizacion org = new Organizacion();
        org.setId(5L);
        org.setReferente(referente);

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));

        org.example.organizacion.dto.ActualizarOrganizacionRequest request =
                new org.example.organizacion.dto.ActualizarOrganizacionRequest();
        request.setSitioWebUrl("https://new.org");

        assertThatThrownBy(() -> organizacionService.actualizar(5L, request, 999L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    // --- actualizarInfoPublica (admin direct edit) ---

    @Test
    void actualizarInfoPublica_writesLiveImmediatelyAndClearsPending() {
        Organizacion org = new Organizacion();
        org.setId(5L);
        org.setSitioWebUrl("https://old.org");
        org.setSitioWebUrlPendiente("https://pending-from-referente.org");
        org.setInfoPublicaPendienteEn(java.time.LocalDateTime.now());

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> inv.getArgument(0));

        org.example.organizacion.dto.ActualizarInfoPublicaRequest request =
                new org.example.organizacion.dto.ActualizarInfoPublicaRequest(true, "https://admin-set.org", null, null, null);

        OrganizacionResponse response = organizacionService.actualizarInfoPublica(5L, request);

        assertThat(response.getSitioWebUrl()).isEqualTo("https://admin-set.org");
        assertThat(response.getAceptaDonaciones()).isTrue();
        assertThat(response.getInfoPublicaPendienteEn()).isNull();
        assertThat(org.getSitioWebUrlPendiente()).isNull();
    }

    @Test
    void actualizarInfoPublica_setsProfileImageKeyAndBannerKeyWhenPresent() {
        Organizacion org = new Organizacion();
        org.setId(5L);
        org.setProfileImageKey("org-profile/5/old.jpg");
        org.setBannerKey("org-banner/5/old.jpg");

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> inv.getArgument(0));

        org.example.organizacion.dto.ActualizarInfoPublicaRequest request =
                new org.example.organizacion.dto.ActualizarInfoPublicaRequest(
                        null, null, null, "org-profile/5/new.jpg", "org-banner/5/new.jpg");

        OrganizacionResponse response = organizacionService.actualizarInfoPublica(5L, request);

        assertThat(response.getProfileImageKey()).isEqualTo("org-profile/5/new.jpg");
        assertThat(response.getBannerKey()).isEqualTo("org-banner/5/new.jpg");
    }

    @Test
    void actualizarInfoPublica_leavesImageKeysUntouchedWhenAbsent() {
        Organizacion org = new Organizacion();
        org.setId(5L);
        org.setProfileImageKey("org-profile/5/old.jpg");
        org.setBannerKey("org-banner/5/old.jpg");

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> inv.getArgument(0));

        org.example.organizacion.dto.ActualizarInfoPublicaRequest request =
                new org.example.organizacion.dto.ActualizarInfoPublicaRequest(true, null, null, null, null);

        OrganizacionResponse response = organizacionService.actualizarInfoPublica(5L, request);

        assertThat(response.getProfileImageKey()).isEqualTo("org-profile/5/old.jpg");
        assertThat(response.getBannerKey()).isEqualTo("org-banner/5/old.jpg");
    }

    // --- aprobarInfoPublica / rechazarInfoPublica ---

    @Test
    void aprobarInfoPublica_copiesSnapshotToLiveAndClearsPending() {
        Organizacion org = new Organizacion();
        org.setId(5L);
        org.setAceptaDonaciones(false);
        org.setSitioWebUrl("https://old.org");
        org.setAceptaDonacionesPendiente(true);
        org.setSitioWebUrlPendiente("https://new.org");
        org.setDonacionDirectaUrlPendiente("https://mp.example.org");
        org.setInfoPublicaPendienteEn(java.time.LocalDateTime.now());

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> inv.getArgument(0));

        OrganizacionResponse response = organizacionService.aprobarInfoPublica(5L);

        assertThat(response.getAceptaDonaciones()).isTrue();
        assertThat(response.getSitioWebUrl()).isEqualTo("https://new.org");
        assertThat(response.getDonacionDirectaUrl()).isEqualTo("https://mp.example.org");
        assertThat(response.getInfoPublicaPendienteEn()).isNull();
        assertThat(org.getSitioWebUrlPendiente()).isNull();
    }

    @Test
    void aprobarInfoPublica_noPending_throws409() {
        Organizacion org = new Organizacion();
        org.setId(5L);

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));

        assertThatThrownBy(() -> organizacionService.aprobarInfoPublica(5L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
    }

    @Test
    void rechazarInfoPublica_clearsPendingWithoutTouchingLive() {
        Organizacion org = new Organizacion();
        org.setId(5L);
        org.setSitioWebUrl("https://old.org");
        org.setSitioWebUrlPendiente("https://new.org");
        org.setInfoPublicaPendienteEn(java.time.LocalDateTime.now());

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> inv.getArgument(0));

        OrganizacionResponse response = organizacionService.rechazarInfoPublica(5L);

        assertThat(response.getSitioWebUrl()).isEqualTo("https://old.org");
        assertThat(org.getSitioWebUrlPendiente()).isNull();
        assertThat(org.getInfoPublicaPendienteEn()).isNull();
    }

    @Test
    void rechazarInfoPublica_noPending_throws409() {
        Organizacion org = new Organizacion();
        org.setId(5L);

        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org));

        assertThatThrownBy(() -> organizacionService.rechazarInfoPublica(5L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
    }

    // --- toResponse vs toResponseAutenticado (D6) ---

    @Test
    void toResponse_public_neverLeaksPendingFields() {
        Organizacion org = new Organizacion();
        org.setId(5L);
        org.setAceptaDonaciones(null); // D4: nullable, coalesced to false
        org.setSitioWebUrlPendiente("https://leak.org");
        org.setInfoPublicaPendienteEn(java.time.LocalDateTime.now());

        OrganizacionResponse response = organizacionService.toResponse(org);

        assertThat(response.getAceptaDonaciones()).isFalse();
        assertThat(response.getSitioWebUrlPendiente()).isNull();
        assertThat(response.getInfoPublicaPendienteEn()).isNull();
    }

    @Test
    void toResponseAutenticado_includesPendingFields() {
        Organizacion org = new Organizacion();
        org.setId(5L);
        org.setSitioWebUrlPendiente("https://pending.org");
        org.setInfoPublicaPendienteEn(java.time.LocalDateTime.now());

        OrganizacionResponse response = organizacionService.toResponseAutenticado(org);

        assertThat(response.getSitioWebUrlPendiente()).isEqualTo("https://pending.org");
        assertThat(response.getInfoPublicaPendienteEn()).isNotNull();
    }

    @Test
    void findBySlug_aprobadaOrg_nonOwnerAuthenticated_doesNotLeakPending() {
        Organizacion org = new Organizacion();
        org.setId(10L);
        org.setSlug("comedor-validado");
        org.setEstado(EstadoOrganizacion.APROBADA);
        org.setReferente(referente); // referente.id = 1L
        org.setSitioWebUrlPendiente("https://leak.org");
        org.setInfoPublicaPendienteEn(java.time.LocalDateTime.now());

        when(organizacionRepository.findBySlug("comedor-validado")).thenReturn(Optional.of(org));

        // requestingUserId=99L (a donante, not the owner) — must not see pending
        OrganizacionResponse response = organizacionService.findBySlug("comedor-validado", 99L, "ROLE_DONANTE");

        assertThat(response.getSitioWebUrlPendiente()).isNull();
    }

    @Test
    void findBySlug_aprobadaOrg_owningReferente_seesPending() {
        Organizacion org = new Organizacion();
        org.setId(10L);
        org.setSlug("comedor-validado");
        org.setEstado(EstadoOrganizacion.APROBADA);
        org.setReferente(referente); // referente.id = 1L
        org.setSitioWebUrlPendiente("https://pending.org");
        org.setInfoPublicaPendienteEn(java.time.LocalDateTime.now());

        when(organizacionRepository.findBySlug("comedor-validado")).thenReturn(Optional.of(org));

        OrganizacionResponse response = organizacionService.findBySlug("comedor-validado", 1L, "ROLE_REFERENTE");

        assertThat(response.getSitioWebUrlPendiente()).isEqualTo("https://pending.org");
    }

    @Test
    void asignarReferente_recordsReassignmentAndPassesTheAdminActorToTheEventLog() {
        Organizacion org = new org.example.domain.Organizacion();
        org.setId(10L);
        org.setReferente(referente);
        Referente nuevo = new Referente(3L, "Nuevo", "nuevo@test.com", "encoded", true);
        when(organizacionRepository.findById(10L)).thenReturn(Optional.of(org));
        when(usuarioRepository.findById(3L)).thenReturn(Optional.of(nuevo));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(administrador));
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> inv.getArgument(0));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        2L, null, List.of(new SimpleGrantedAuthority("ROLE_ADMINISTRADOR"))));
        try {
            organizacionService.asignarReferente(10L,
                    new org.example.organizacion.dto.AsignarReferenteRequest(3L));
        } finally {
            SecurityContextHolder.clearContext();
        }

        verify(acreditacionService).registrarReasignacionReferente(org, 1L, 3L, administrador);
        ArgumentCaptor<ActividadService.Registro> captor =
                ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService).registrar(captor.capture());
        assertThat(captor.getValue().accion())
                .isEqualTo(TipoActividad.ORGANIZACION_REFERENTE_REASIGNADO);
        assertThat(captor.getValue().antes()).isEqualTo("1");
        assertThat(captor.getValue().despues()).isEqualTo("3");
    }

    @Test
    void crear_passesTheReferenteAsActorOfTheRegistrationEvent() {
        CrearOrganizacionRequest request = new CrearOrganizacionRequest(
                "Org Test", TipoOrganizacion.COMEDOR, "Una descripcion", "Calle 123", -34.0, -58.0,
                null, null, null);
        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(referente));
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> {
            Organizacion o = inv.getArgument(0);
            o.setId(10L);
            return o;
        });

        organizacionService.crear(request, 1L);

        verify(acreditacionService).registrarRegistroOrganizacion(any(Organizacion.class), eq(referente));
        ArgumentCaptor<ActividadService.Registro> captor =
                ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService).registrar(captor.capture());
        assertThat(captor.getValue().accion())
                .isEqualTo(TipoActividad.ORGANIZACION_CREADA);
        assertThat(captor.getValue().entidadId()).isEqualTo(10L);
    }
}
