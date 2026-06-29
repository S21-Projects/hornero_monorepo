package org.example.necesidad;

import org.example.domain.EstadoNecesidad;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
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

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NecesidadServiceTest {

    @Mock
    private NecesidadRepository necesidadRepository;

    @Mock
    private OrganizacionRepository organizacionRepository;

    @InjectMocks
    private NecesidadService necesidadService;

    private Organizacion organizacion;
    private Pageable defaultPageable;

    @BeforeEach
    void setUp() {
        organizacion = new Organizacion();
        organizacion.setId(1L);
        organizacion.setNombre("Org Test");
        organizacion.setEstado(EstadoOrganizacion.APROBADA);
        defaultPageable = PageRequest.of(0, 20);
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
        List<Necesidad> content = List.of(buildNecesidad(1L), buildNecesidad(2L));
        Page<Necesidad> repoPage = new PageImpl<>(content, defaultPageable, 2L);

        when(necesidadRepository.findByOrganizacion_Id(1L, defaultPageable)).thenReturn(repoPage);

        Page<NecesidadResponse> result = necesidadService.findByOrganizacion(1L, defaultPageable);

        assertThat(result.getContent()).hasSize(2);
        assertThat(result.getContent().get(0).organizacionId()).isEqualTo(1L);
        assertThat(result.getContent().get(1).organizacionId()).isEqualTo(1L);
    }

    @Test
    void findByOrganizacion_repoReturnsEmpty_returnsEmptyPage() {
        Page<Necesidad> emptyPage = new PageImpl<>(List.of(), defaultPageable, 0L);
        when(necesidadRepository.findByOrganizacion_Id(99L, defaultPageable)).thenReturn(emptyPage);

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

        when(necesidadRepository.findAll(defaultPageable)).thenReturn(repoPage);

        Page<NecesidadResponse> result = necesidadService.findAll(defaultPageable);

        assertThat(result.getContent()).hasSize(3);
    }

    @Test
    void findAll_repoReturnsEmpty_returnsEmptyPage() {
        Page<Necesidad> emptyPage = new PageImpl<>(List.of(), defaultPageable, 0L);
        when(necesidadRepository.findAll(defaultPageable)).thenReturn(emptyPage);

        Page<NecesidadResponse> result = necesidadService.findAll(defaultPageable);

        assertThat(result).isNotNull();
        assertThat(result.getContent()).isEmpty();
    }
}
