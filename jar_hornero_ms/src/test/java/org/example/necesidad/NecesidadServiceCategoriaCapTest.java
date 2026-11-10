package org.example.necesidad;

import org.example.actividad.ActividadService;
import org.example.auth.VerificacionService;
import org.example.config.AcreditacionProperties;
import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.example.domain.UnidadArticulo;
import org.example.necesidad.dto.CrearNecesidadRequest;
import org.example.user.Referente;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * `specs/organizacion-acreditacion/spec.md` "Level-Driven Food Category Caps": N1 permits
 * non-perishable categories only; N2 additionally permits refrigerated and frozen categories; N3
 * permits all categories. A {@code categoria = null} necesidad MUST continue to behave exactly as
 * it did before this cap existed.
 */
@ExtendWith(MockitoExtension.class)
class NecesidadServiceCategoriaCapTest {

    @Mock
    private NecesidadRepository necesidadRepository;

    @Mock
    private OrganizacionRepository organizacionRepository;

    @Mock
    private VerificacionService verificacionService;

    @Mock
    private AcreditacionProperties acreditacionProperties;

    @Mock
    private ArticuloRepository articuloRepository;

    @org.mockito.Spy
    private java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("America/Argentina/Buenos_Aires"));

    @Mock
    private ActividadService actividadService;

    @InjectMocks
    private NecesidadService necesidadService;

    private Referente referente;
    private long nextArticuloId;

    @BeforeEach
    void setUp() {
        referente = new Referente(1L, "Ref Test", "ref@test.com", "encoded", true);
        nextArticuloId = 1L;
        lenient().when(necesidadRepository.countByOrganizacion_IdAndEstadoIn(eq(1L), any())).thenReturn(0L);
        lenient().when(necesidadRepository.save(any(Necesidad.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private Organizacion organizacionAt(NivelAcreditacion nivel) {
        Organizacion org = new Organizacion();
        org.setId(1L);
        org.setNombre("Org Test");
        org.setEstado(EstadoOrganizacion.APROBADA);
        org.setNivel(nivel);
        org.setReferente(referente);
        return org;
    }

    /**
     * Builds a request selecting one freshly-minted articulo of the given categoria (feature
     * catalogo-articulos, decision 6: categoria is now derived from the selection, never
     * hand-picked) and stubs the repository to resolve it.
     */
    private CrearNecesidadRequest requestCon(CategoriaAlimento categoria) {
        long articuloId = nextArticuloId++;
        Articulo articulo = new Articulo();
        articulo.setId(articuloId);
        articulo.setNombre("Articulo " + articuloId);
        articulo.setCategoria(categoria);
        articulo.setUnidad(UnidadArticulo.KG);
        articulo.setActivo(true);
        lenient().when(articuloRepository.findById(articuloId)).thenReturn(Optional.of(articulo));
        return new CrearNecesidadRequest(
                "Descripcion", PrioridadNecesidad.MEDIA, LocalDate.now().plusDays(10), 1L, List.of(articuloId));
    }

    @Test
    void n1OrganizacionRequestingRefrigeradoIsRejected() {
        Organizacion org = organizacionAt(NivelAcreditacion.N1);
        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(org));
        when(acreditacionProperties.capPara(NivelAcreditacion.N1)).thenReturn(3L);

        assertThatThrownBy(() -> necesidadService.crear(requestCon(CategoriaAlimento.REFRIGERADO), 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("N2");
    }

    @Test
    void n1OrganizacionRequestingCongeladoIsRejected() {
        Organizacion org = organizacionAt(NivelAcreditacion.N1);
        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(org));
        when(acreditacionProperties.capPara(NivelAcreditacion.N1)).thenReturn(3L);

        assertThatThrownBy(() -> necesidadService.crear(requestCon(CategoriaAlimento.CONGELADO), 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("N2");
    }

    @Test
    void n2OrganizacionRequestingRefrigeradoSucceeds() {
        Organizacion org = organizacionAt(NivelAcreditacion.N2);
        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(org));
        when(acreditacionProperties.capPara(NivelAcreditacion.N2)).thenReturn(6L);

        var response = necesidadService.crear(requestCon(CategoriaAlimento.REFRIGERADO), 1L);

        assertThat(response.organizacionId()).isEqualTo(1L);
    }

    @Test
    void n3OrganizacionRequestingAnyCategoriaSucceeds() {
        Organizacion org = organizacionAt(NivelAcreditacion.N3);
        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(org));
        when(acreditacionProperties.capPara(NivelAcreditacion.N3)).thenReturn(12L);

        for (CategoriaAlimento categoria : CategoriaAlimento.values()) {
            var response = necesidadService.crear(requestCon(categoria), 1L);
            assertThat(response.organizacionId()).isEqualTo(1L);
        }
    }

    // Feature catalogo-articulos, decision 6: a necesidad with zero articulos no longer exists —
    // categoria can never be hand-picked/null on the crear path anymore, it is always derived.
    @Test
    void crearSinArticulosEsRechazada() {
        CrearNecesidadRequest dto = new CrearNecesidadRequest(
                "Descripcion", PrioridadNecesidad.MEDIA, LocalDate.now().plusDays(10), 1L, List.of());

        assertThatThrownBy(() -> necesidadService.crear(dto, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }
}
