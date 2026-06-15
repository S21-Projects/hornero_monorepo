package org.example.necesidad;

import org.example.domain.EstadoNecesidad;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.Organizacion;
import org.example.domain.PrioridadNecesidad;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NecesidadServiceTest {

    @Mock
    private NecesidadRepository necesidadRepository;

    @InjectMocks
    private NecesidadService necesidadService;

    private Organizacion organizacion;

    @BeforeEach
    void setUp() {
        organizacion = new Organizacion();
        organizacion.setId(1L);
        organizacion.setNombre("Org Test");
        organizacion.setEstado(EstadoOrganizacion.APROBADA);
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

    // --- findByOrganizacion ---

    @Test
    void findByOrganizacion_repoReturnsTwoResults_returnsListOfTwo() {
        when(necesidadRepository.findByOrganizacion_Id(1L))
                .thenReturn(List.of(buildNecesidad(1L), buildNecesidad(2L)));

        List<NecesidadResponse> result = necesidadService.findByOrganizacion(1L);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).organizacionId()).isEqualTo(1L);
        assertThat(result.get(1).organizacionId()).isEqualTo(1L);
    }

    @Test
    void findByOrganizacion_repoReturnsEmpty_returnsEmptyList() {
        when(necesidadRepository.findByOrganizacion_Id(99L)).thenReturn(List.of());

        List<NecesidadResponse> result = necesidadService.findByOrganizacion(99L);

        assertThat(result).isNotNull();
        assertThat(result).isEmpty();
    }

    // --- findAll ---

    @Test
    void findAll_repoReturnsThreeResults_returnsListOfThree() {
        when(necesidadRepository.findAll())
                .thenReturn(List.of(buildNecesidad(1L), buildNecesidad(2L), buildNecesidad(3L)));

        List<NecesidadResponse> result = necesidadService.findAll();

        assertThat(result).hasSize(3);
    }

    @Test
    void findAll_repoReturnsEmpty_returnsEmptyList() {
        when(necesidadRepository.findAll()).thenReturn(List.of());

        List<NecesidadResponse> result = necesidadService.findAll();

        assertThat(result).isNotNull();
        assertThat(result).isEmpty();
    }
}
