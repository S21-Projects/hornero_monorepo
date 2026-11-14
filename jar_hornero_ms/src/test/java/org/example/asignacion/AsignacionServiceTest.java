package org.example.asignacion;

import org.example.asignacion.dto.AsignacionResponse;
import org.example.domain.Asignacion;
import org.example.domain.AsignacionRepository;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoAsignacion;
import org.example.domain.EstadoRonda;
import org.example.domain.Organizacion;
import org.example.domain.Ronda;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.example.user.Donante;
import org.example.user.Referente;

import java.time.Instant;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * Ownership guard for {@code historial(...)} (AD-9, spec `ronda-asignacion`): owning donante, any
 * referente involved in the donación's assignment history, and admin may see it; a non-owning
 * donante or an uninvolved referente get a 403.
 */
@ExtendWith(MockitoExtension.class)
class AsignacionServiceTest {

    @Mock
    private DonacionRepository donacionRepository;

    @Mock
    private AsignacionRepository asignacionRepository;

    @Mock
    private org.example.domain.RondaRepository rondaRepository;

    private AsignacionService asignacionService;

    private Donacion donacion;
    private Organizacion organizacion;
    private Asignacion asignacion;

    @BeforeEach
    void setUp() {
        asignacionService = new AsignacionService(donacionRepository, asignacionRepository, rondaRepository);

        Donante donante = new Donante(7L, "Dueño", "dueno@test.com", "x", true);
        donacion = new Donacion();
        donacion.setId(1L);
        donacion.setDonante(donante);

        Referente referente = new Referente(3L, "Referente", "referente@test.com", "x", true);
        organizacion = new Organizacion();
        organizacion.setId(10L);
        organizacion.setReferente(referente);

        asignacion = new Asignacion();
        asignacion.setId(100L);
        asignacion.setDonacion(donacion);
        asignacion.setOrganizacion(organizacion);
        asignacion.setEstado(EstadoAsignacion.ACEPTADA);

        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(donacion));
        when(asignacionRepository.findByDonacion_IdOrderByCreadaEnDesc(1L)).thenReturn(List.of(asignacion));
    }

    @Test
    void owningDonante_succeeds() {
        List<?> result = asignacionService.historial(1L, 7L, false);

        assertThat(result).hasSize(1);
    }

    @Test
    void involvedReferente_succeeds() {
        List<?> result = asignacionService.historial(1L, 3L, false);

        assertThat(result).hasSize(1);
    }

    @Test
    void admin_succeeds() {
        List<?> result = asignacionService.historial(1L, 999L, true);

        assertThat(result).hasSize(1);
    }

    /**
     * Task 5f.15: `AsignacionResponse` must expose the weights the ronda actually applied (from
     * `asignacion.getRonda()`), not the worker's pre-6a hardcoded defaults the admin SPA falls
     * back to — otherwise "term × weight" drifts once 6a renormalizes or a ronda uses overrides.
     */
    @Test
    void toResponse_exposesTheRondasAppliedWeights() {
        Ronda ronda = new Ronda();
        ronda.setId(9L);
        ronda.setEjecutadaEn(Instant.parse("2026-09-20T12:00:00Z"));
        ronda.setEjecutadaPor(1L);
        ronda.setEstado(EstadoRonda.COMPLETADA);
        ronda.setVersionContrato(1);
        ronda.setPesoDeficit(0.30);
        ronda.setPesoUrgencia(0.25);
        ronda.setPesoProximidad(0.17);
        ronda.setPesoEspera(0.13);
        ronda.setPesoCumplimiento(0.15);
        asignacion.setRonda(ronda);

        List<AsignacionResponse> result = asignacionService.historial(1L, 999L, true);

        AsignacionResponse response = result.get(0);
        assertThat(response.pesoDeficit()).isEqualTo(0.30);
        assertThat(response.pesoUrgencia()).isEqualTo(0.25);
        assertThat(response.pesoProximidad()).isEqualTo(0.17);
        assertThat(response.pesoEspera()).isEqualTo(0.13);
        assertThat(response.pesoCumplimiento()).isEqualTo(0.15);
    }

    @Test
    void toResponse_nullWeightsWhenRondaHasNone() {
        Ronda ronda = new Ronda();
        ronda.setId(9L);
        ronda.setEjecutadaEn(Instant.parse("2026-09-20T12:00:00Z"));
        asignacion.setRonda(ronda);

        List<AsignacionResponse> result = asignacionService.historial(1L, 999L, true);

        AsignacionResponse response = result.get(0);
        assertThat(response.pesoDeficit()).isNull();
        assertThat(response.pesoCumplimiento()).isNull();
    }

    @Test
    void nonOwningDonante_isForbidden() {
        assertThatThrownBy(() -> asignacionService.historial(1L, 999L, false))
                .isInstanceOf(ResponseStatusException.class)
                .hasFieldOrPropertyWithValue("statusCode", HttpStatus.FORBIDDEN);
    }

    @Test
    void uninvolvedReferente_isForbidden() {
        assertThatThrownBy(() -> asignacionService.historial(1L, 123L, false))
                .isInstanceOf(ResponseStatusException.class)
                .hasFieldOrPropertyWithValue("statusCode", HttpStatus.FORBIDDEN);
    }
}
