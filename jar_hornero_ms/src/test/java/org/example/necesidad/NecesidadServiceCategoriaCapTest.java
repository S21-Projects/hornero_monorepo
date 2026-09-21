package org.example.necesidad;

import org.example.auth.VerificacionService;
import org.example.config.AcreditacionProperties;
import org.example.domain.CategoriaAlimento;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
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
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
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

    @InjectMocks
    private NecesidadService necesidadService;

    private Referente referente;

    @BeforeEach
    void setUp() {
        referente = new Referente(1L, "Ref Test", "ref@test.com", "encoded", true);
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

    private CrearNecesidadRequest requestCon(CategoriaAlimento categoria) {
        return new CrearNecesidadRequest(
                "Descripcion", PrioridadNecesidad.MEDIA, LocalDate.now().plusDays(10), 1L, categoria);
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

    @Test
    void categoriaNullBehavesExactlyAsBeforeAtN1() {
        Organizacion org = organizacionAt(NivelAcreditacion.N1);
        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(org));
        when(acreditacionProperties.capPara(NivelAcreditacion.N1)).thenReturn(3L);

        var response = necesidadService.crear(requestCon(null), 1L);

        assertThat(response.organizacionId()).isEqualTo(1L);
        assertThat(response.categoria()).isNull();
    }
}
