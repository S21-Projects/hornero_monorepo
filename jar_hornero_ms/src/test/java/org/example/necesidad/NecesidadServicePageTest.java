package org.example.necesidad;

import org.example.actividad.ActividadService;
import org.example.domain.EstadoNecesidad;
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

/**
 * T-MS-22: NecesidadService.findAll(Pageable) delegates Page.map correctly,
 * preserving totalElements, number, and size from the underlying repository Page.
 */
@ExtendWith(MockitoExtension.class)
class NecesidadServicePageTest {

    @Mock
    private NecesidadRepository necesidadRepository;

    @Mock
    private OrganizacionRepository organizacionRepository;

    @org.mockito.Spy
    private java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("America/Argentina/Buenos_Aires"));

    @Mock
    private ActividadService actividadService;

    @InjectMocks
    private NecesidadService necesidadService;

    private Organizacion organizacion;

    @BeforeEach
    void setUp() {
        organizacion = new Organizacion();
        organizacion.setId(1L);
        organizacion.setNombre("Comedor Sol");
    }

    private Necesidad buildNecesidad(Long id) {
        Necesidad n = new Necesidad();
        n.setId(id);
        n.setDescripcion("Descripcion " + id);
        n.setPrioridad(PrioridadNecesidad.MEDIA);
        n.setEstado(EstadoNecesidad.ABIERTA);
        n.setFechaPublicacion(LocalDate.now());
        n.setOrganizacion(organizacion);
        return n;
    }

    @Test
    void findAll_pageMetadata_preserved() {
        // PageRequest.of(1, 5): offset=5, pageSize=5. Total=15. offset+pageSize=10 <= 15 → no normalisation.
        Pageable pageable = PageRequest.of(1, 5);
        List<Necesidad> content = List.of(buildNecesidad(1L), buildNecesidad(2L), buildNecesidad(3L),
                buildNecesidad(4L), buildNecesidad(5L));
        Page<Necesidad> repoPage = new PageImpl<>(content, pageable, 15L);

        when(necesidadRepository.findPublicas(null, pageable)).thenReturn(repoPage);

        Page<NecesidadResponse> result = necesidadService.findAll(pageable);

        assertThat(result.getTotalElements()).isEqualTo(15L);
        assertThat(result.getNumber()).isEqualTo(1);
        assertThat(result.getSize()).isEqualTo(5);
        assertThat(result.getTotalPages()).isEqualTo(3); // ceil(15/5)
        assertThat(result.getContent()).hasSize(5);
        assertThat(result.getContent().get(0).organizacionId()).isEqualTo(1L);
        assertThat(result.getContent().get(0).organizacionNombre()).isEqualTo("Comedor Sol");
    }

    @Test
    void findByOrganizacion_pageMetadata_preserved() {
        Pageable pageable = PageRequest.of(0, 3);
        List<Necesidad> content = List.of(buildNecesidad(10L));
        Page<Necesidad> repoPage = new PageImpl<>(content, pageable, 7L);

        when(necesidadRepository.findByOrganizacion_IdAndEstadoNot(1L, EstadoNecesidad.VENCIDA, pageable)).thenReturn(repoPage);

        Page<NecesidadResponse> result = necesidadService.findByOrganizacion(1L, pageable);

        assertThat(result.getTotalElements()).isEqualTo(7L);
        assertThat(result.getNumber()).isEqualTo(0);
        assertThat(result.getSize()).isEqualTo(3);
        assertThat(result.getTotalPages()).isEqualTo(3); // ceil(7/3)
    }
}
