package org.example.donacion;

import org.example.auth.VerificacionService;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.donacion.dto.CreateDonacionRequest;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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

    @InjectMocks
    private DonacionService donacionService;

    private Referente referente;
    private Organizacion miOrganizacion;
    private Donante donante;

    @BeforeEach
    void setUp() {
        referente = new Referente(1L, "Ref Test", "ref@test.com", "encoded", true);
        donante = new Donante(2L, "Donante Test", "donante@test.com", "encoded", true);

        miOrganizacion = new Organizacion();
        miOrganizacion.setId(10L);
        miOrganizacion.setNombre("Comedor Test");
        miOrganizacion.setReferente(referente);
    }

    private Donacion donacionFor(Long id, Organizacion org) {
        Necesidad necesidad = new Necesidad();
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

    // --- findDeMisOrganizaciones ---

    @Test
    void findDeMisOrganizaciones_noOrgIdFilter_returnsAcrossAllOwnedOrgs() {
        Donacion d1 = donacionFor(1L, miOrganizacion);
        Donacion d2 = donacionFor(2L, miOrganizacion);

        when(donacionRepository.findByOrganizacion_Referente_Id(1L)).thenReturn(List.of(d1, d2));

        List<DonacionResponse> result = donacionService.findDeMisOrganizaciones(1L, null);

        assertThat(result).hasSize(2);
        assertThat(result).allSatisfy(r -> assertThat(r.organizacionId()).isEqualTo(10L));
    }

    @Test
    void findDeMisOrganizaciones_withOrgIdFilter_scopesToThatOrg() {
        when(organizacionRepository.findByIdAndReferente_Id(10L, 1L)).thenReturn(Optional.of(miOrganizacion));
        when(donacionRepository.findByOrganizacionId(10L)).thenReturn(List.of(donacionFor(1L, miOrganizacion)));

        List<DonacionResponse> result = donacionService.findDeMisOrganizaciones(1L, 10L);

        assertThat(result).hasSize(1);
        org.mockito.Mockito.verify(donacionRepository).findByOrganizacionId(10L);
    }

    @Test
    void findDeMisOrganizaciones_foreignOrgIdFilter_throwsForbidden() {
        when(organizacionRepository.findByIdAndReferente_Id(20L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> donacionService.findDeMisOrganizaciones(1L, 20L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void findDeMisOrganizaciones_noOrgs_returnsEmptyList() {
        when(donacionRepository.findByOrganizacion_Referente_Id(1L)).thenReturn(List.of());

        List<DonacionResponse> result = donacionService.findDeMisOrganizaciones(1L, null);

        assertThat(result).isEmpty();
    }

    // --- crear ---

    @Test
    void crear_verifiedDonante_succeeds() {
        Necesidad necesidad = new Necesidad();
        necesidad.setId(100L);
        necesidad.setOrganizacion(miOrganizacion);

        CreateDonacionRequest dto = new CreateDonacionRequest();
        dto.setNecesidadId(100L);
        dto.setObservaciones("Puedo traer 10 litros esta semana");

        when(necesidadRepository.findById(100L)).thenReturn(Optional.of(necesidad));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));
        when(donacionRepository.save(any(Donacion.class))).thenAnswer(inv -> inv.getArgument(0));

        DonacionResponse response = donacionService.crear(dto, 2L);

        assertThat(response.necesidadId()).isEqualTo(100L);
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

    // ─── findActivas ───────────────────────────────────────────────────────

    @Test
    void findActivas_noEstadoFilter_queriesNoTerminales() {
        var pageable = org.springframework.data.domain.PageRequest.of(0, 20);
        when(donacionRepository.findActivas(EstadoDonacion.NO_TERMINALES, null, pageable))
                .thenReturn(org.springframework.data.domain.Page.empty());

        donacionService.findActivas(null, null, pageable);

        verify(donacionRepository).findActivas(EstadoDonacion.NO_TERMINALES, null, pageable);
    }

    @Test
    void findActivas_estadoFilter_queriesSingleEstado() {
        var pageable = org.springframework.data.domain.PageRequest.of(0, 20);
        when(donacionRepository.findActivas(java.util.EnumSet.of(EstadoDonacion.ACEPTADA), "org", pageable))
                .thenReturn(org.springframework.data.domain.Page.empty());

        donacionService.findActivas("org", EstadoDonacion.ACEPTADA, pageable);

        verify(donacionRepository).findActivas(java.util.EnumSet.of(EstadoDonacion.ACEPTADA), "org", pageable);
    }

    @Test
    void findActivas_terminalEstadoFilter_rejectedWith400() {
        var pageable = org.springframework.data.domain.PageRequest.of(0, 20);

        assertThatThrownBy(() -> donacionService.findActivas(null, EstadoDonacion.ENTREGADA, pageable))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400")
                .hasMessageContaining("ENTREGADA");
        verifyNoInteractions(donacionRepository);
    }
}
