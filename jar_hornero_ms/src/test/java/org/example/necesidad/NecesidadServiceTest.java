package org.example.necesidad;

import org.example.auth.VerificacionService;
import org.example.domain.EstadoNecesidad;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.example.necesidad.dto.CrearNecesidadRequest;
import org.example.user.Referente;
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

    @InjectMocks
    private NecesidadService necesidadService;

    private Organizacion organizacion;
    private Referente referente;

    @BeforeEach
    void setUp() {
        referente = new Referente(1L, "Ref Test", "ref@test.com", "encoded", true);

        organizacion = new Organizacion();
        organizacion.setId(1L);
        organizacion.setNombre("Org Test");
        organizacion.setEstado(EstadoOrganizacion.APROBADA);
        organizacion.setReferente(referente);
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

    // --- crear ---

    @Test
    void crear_foreignOrganizacionId_throwsForbidden() {
        CrearNecesidadRequest dto = new CrearNecesidadRequest(
                "Descripcion", PrioridadNecesidad.MEDIA, LocalDate.now().plusDays(10), 99L);

        when(organizacionRepository.findByIdAndReferente_Id(99L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> necesidadService.crear(dto, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void crear_ownedOrganizacionId_succeeds() {
        CrearNecesidadRequest dto = new CrearNecesidadRequest(
                "Descripcion", PrioridadNecesidad.MEDIA, LocalDate.now().plusDays(10), 1L);

        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(organizacion));
        when(necesidadRepository.save(org.mockito.ArgumentMatchers.any(Necesidad.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        NecesidadResponse response = necesidadService.crear(dto, 1L);

        assertThat(response.organizacionId()).isEqualTo(1L);
        verify(verificacionService).requireVerified(1L);
    }

    @Test
    void crear_unverifiedEmail_throwsForbiddenBeforeTouchingOrganizacion() {
        CrearNecesidadRequest dto = new CrearNecesidadRequest(
                "Descripcion", PrioridadNecesidad.MEDIA, LocalDate.now().plusDays(10), 1L);

        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "EMAIL_NO_VERIFICADO"))
                .when(verificacionService).requireVerified(1L);

        assertThatThrownBy(() -> necesidadService.crear(dto, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("EMAIL_NO_VERIFICADO");

        org.mockito.Mockito.verifyNoInteractions(organizacionRepository);
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
}
