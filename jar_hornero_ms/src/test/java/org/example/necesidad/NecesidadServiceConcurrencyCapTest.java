package org.example.necesidad;

import org.example.auth.VerificacionService;
import org.example.config.AcreditacionProperties;
import org.example.domain.EstadoNecesidad;
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
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * `specs/organizacion-acreditacion/spec.md` "Level-Driven Concurrency Caps": N0 = 0, N1 = 3
 * (default), N2 = 6, N3 = 12 open (`ABIERTA`/`EN_PROGRESO`) `necesidad` records; cap values are
 * configuration (`AcreditacionProperties`), not hardcoded.
 */
@ExtendWith(MockitoExtension.class)
class NecesidadServiceConcurrencyCapTest {

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

    private CrearNecesidadRequest sampleRequest() {
        return new CrearNecesidadRequest("Descripcion", PrioridadNecesidad.MEDIA, LocalDate.now().plusDays(10), 1L, null);
    }

    @Test
    void atCapIsRejectedWith409() {
        Organizacion org = organizacionAt(NivelAcreditacion.N1);
        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(org));
        when(acreditacionProperties.capPara(NivelAcreditacion.N1)).thenReturn(3L);
        when(necesidadRepository.countByOrganizacion_IdAndEstadoIn(eq(1L), any())).thenReturn(3L);

        assertThatThrownBy(() -> necesidadService.crear(sampleRequest(), 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
    }

    @Test
    void underCapByOneSucceeds() {
        Organizacion org = organizacionAt(NivelAcreditacion.N1);
        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(org));
        when(acreditacionProperties.capPara(NivelAcreditacion.N1)).thenReturn(3L);
        when(necesidadRepository.countByOrganizacion_IdAndEstadoIn(eq(1L), any())).thenReturn(2L);
        when(necesidadRepository.save(any(Necesidad.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = necesidadService.crear(sampleRequest(), 1L);

        assertThat(response.organizacionId()).isEqualTo(1L);
    }

    @Test
    void n0OrganizacionIsRejectedOnFirstAttempt() {
        Organizacion org = organizacionAt(NivelAcreditacion.N0);
        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(org));
        when(acreditacionProperties.capPara(NivelAcreditacion.N0)).thenReturn(0L);
        when(necesidadRepository.countByOrganizacion_IdAndEstadoIn(eq(1L), any())).thenReturn(0L);

        assertThatThrownBy(() -> necesidadService.crear(sampleRequest(), 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
    }

    @Test
    void countsOnlyAbiertaAndEnProgreso() {
        Organizacion org = organizacionAt(NivelAcreditacion.N1);
        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(org));
        when(acreditacionProperties.capPara(NivelAcreditacion.N1)).thenReturn(3L);
        when(necesidadRepository.countByOrganizacion_IdAndEstadoIn(
                eq(1L), eq(Set.of(EstadoNecesidad.ABIERTA, EstadoNecesidad.EN_PROGRESO)))).thenReturn(1L);
        when(necesidadRepository.save(any(Necesidad.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = necesidadService.crear(sampleRequest(), 1L);

        assertThat(response.organizacionId()).isEqualTo(1L);
    }

    @Test
    void overriddenCapTakesEffectWithNoCodeChange() {
        Organizacion org = organizacionAt(NivelAcreditacion.N2);
        when(organizacionRepository.findByIdAndReferente_Id(1L, 1L)).thenReturn(Optional.of(org));
        // Overridden N2 cap (8, not the default 6) — proves the check reads configuration, not a
        // hardcoded constant.
        when(acreditacionProperties.capPara(NivelAcreditacion.N2)).thenReturn(8L);
        when(necesidadRepository.countByOrganizacion_IdAndEstadoIn(eq(1L), any())).thenReturn(7L);
        when(necesidadRepository.save(any(Necesidad.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = necesidadService.crear(sampleRequest(), 1L);

        assertThat(response.organizacionId()).isEqualTo(1L);
    }
}
