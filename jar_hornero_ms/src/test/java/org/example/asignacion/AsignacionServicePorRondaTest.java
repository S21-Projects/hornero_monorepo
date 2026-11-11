package org.example.asignacion;

import org.example.asignacion.dto.AsignacionRondaResponse;
import org.example.domain.Articulo;
import org.example.domain.Asignacion;
import org.example.domain.AsignacionRepository;
import org.example.domain.Donacion;
import org.example.domain.DonacionLinea;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoAsignacion;
import org.example.domain.Necesidad;
import org.example.domain.Organizacion;
import org.example.domain.Ronda;
import org.example.domain.RondaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** {@code AsignacionService.porRonda}: the ronda's assignments for the admin ronda detail. */
@ExtendWith(MockitoExtension.class)
class AsignacionServicePorRondaTest {

    @Mock
    private DonacionRepository donacionRepository;

    @Mock
    private AsignacionRepository asignacionRepository;

    @Mock
    private RondaRepository rondaRepository;

    private AsignacionService service() {
        return new AsignacionService(donacionRepository, asignacionRepository, rondaRepository);
    }

    private Asignacion asignacion(long id, long donacionId, double score, Ronda ronda) {
        Donacion donacion = new Donacion();
        donacion.setId(donacionId);
        Organizacion org = new Organizacion();
        org.setId(10L + id);
        org.setNombre("Org " + id);
        Necesidad necesidad = new Necesidad();
        necesidad.setId(20L + id);
        necesidad.setDescripcion("Necesidad " + id);
        Asignacion a = new Asignacion();
        a.setId(id);
        a.setRonda(ronda);
        a.setDonacion(donacion);
        a.setOrganizacion(org);
        a.setNecesidad(necesidad);
        a.setEstado(EstadoAsignacion.PROPUESTA);
        a.setScore(score);
        return a;
    }

    @Test
    void unknownRonda_is404_andDoesNotQueryAsignaciones() {
        when(rondaRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> service().porRonda(99L))
                .isInstanceOf(ResponseStatusException.class)
                .hasFieldOrPropertyWithValue("statusCode", HttpStatus.NOT_FOUND);
        verify(asignacionRepository, never()).findByRondaIdConRelaciones(99L);
    }

    @Test
    void rondaWithoutAsignaciones_returnsEmptyList() {
        when(rondaRepository.existsById(1L)).thenReturn(true);
        when(asignacionRepository.findByRondaIdConRelaciones(1L)).thenReturn(List.of());

        assertThat(service().porRonda(1L)).isEmpty();
    }

    @Test
    void mapsAsignacionDonacionAndNecesidadContext_keepingRepositoryOrder() {
        Ronda ronda = new Ronda();
        ronda.setId(1L);
        Asignacion mejor = asignacion(5L, 50L, 9.0, ronda);
        Asignacion peor = asignacion(6L, 60L, 2.0, ronda);

        Articulo arroz = new Articulo();
        arroz.setNombre("Arroz");
        DonacionLinea linea = new DonacionLinea();
        linea.setArticulo(arroz);
        linea.setCantidad(new BigDecimal("5.00"));
        mejor.getDonacion().getLineas().add(linea);

        when(rondaRepository.existsById(1L)).thenReturn(true);
        when(asignacionRepository.findByRondaIdConRelaciones(1L)).thenReturn(List.of(mejor, peor));

        List<AsignacionRondaResponse> result = service().porRonda(1L);

        assertThat(result).extracting(r -> r.asignacion().id()).containsExactly(5L, 6L);
        AsignacionRondaResponse first = result.get(0);
        assertThat(first.donacionId()).isEqualTo(50L);
        assertThat(first.donacionDescripcion()).isEqualTo("Arroz x5");
        assertThat(first.necesidadDescripcion()).isEqualTo("Necesidad 5");
        assertThat(first.asignacion().organizacionNombre()).isEqualTo("Org 5");
        assertThat(first.asignacion().rondaId()).isEqualTo(1L);
        assertThat(first.asignacion().estado()).isEqualTo("PROPUESTA");
        assertThat(result.get(1).donacionDescripcion()).isNull();
    }
}
