package org.example.asignacion;

import org.example.domain.Asignacion;
import org.example.domain.AsignacionRepository;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoAsignacion;
import org.example.domain.Organizacion;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.example.user.Donante;
import org.example.user.Referente;

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

    private AsignacionService asignacionService;

    private Donacion donacion;
    private Organizacion organizacion;
    private Asignacion asignacion;

    @BeforeEach
    void setUp() {
        asignacionService = new AsignacionService(donacionRepository, asignacionRepository);

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
