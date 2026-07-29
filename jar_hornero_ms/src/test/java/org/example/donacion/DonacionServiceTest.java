package org.example.donacion;

import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DonacionServiceTest {

    @Mock
    private DonacionRepository donacionRepository;

    @Mock
    private NecesidadRepository necesidadRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private OrganizacionRepository organizacionRepository;

    @InjectMocks
    private DonacionService donacionService;

    private Referente referente;
    private Organizacion miOrganizacion;
    private Donante donante;

    @BeforeEach
    void setUp() {
        referente = new Referente(1L, "Ref Test", "ref@test.com", "encoded", true);
        donante = new Donante(2L, "Donante Test", "donante@test.com", "encoded", true);

        miOrganizacion = new Organizacion();
        miOrganizacion.setId(10L);
        miOrganizacion.setNombre("Comedor Test");
        miOrganizacion.setReferente(referente);
    }

    private Donacion donacionFor(Long id, Organizacion org) {
        Necesidad necesidad = new Necesidad();
        necesidad.setId(100L + id);
        necesidad.setOrganizacion(org);

        Donacion d = new Donacion();
        d.setId(id);
        d.setFechaOferta(LocalDate.now());
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setDonante(donante);
        d.setNecesidad(necesidad);
        return d;
    }

    // --- findDeMisOrganizaciones ---

    @Test
    void findDeMisOrganizaciones_noOrgIdFilter_returnsAcrossAllOwnedOrgs() {
        Donacion d1 = donacionFor(1L, miOrganizacion);
        Donacion d2 = donacionFor(2L, miOrganizacion);

        when(donacionRepository.findByOrganizacion_Referente_Id(1L)).thenReturn(List.of(d1, d2));

        List<DonacionResponse> result = donacionService.findDeMisOrganizaciones(1L, null);

        assertThat(result).hasSize(2);
        assertThat(result).allSatisfy(r -> assertThat(r.organizacionId()).isEqualTo(10L));
    }

    @Test
    void findDeMisOrganizaciones_withOrgIdFilter_scopesToThatOrg() {
        when(organizacionRepository.findByIdAndReferente_Id(10L, 1L)).thenReturn(Optional.of(miOrganizacion));
        when(donacionRepository.findByOrganizacionId(10L)).thenReturn(List.of(donacionFor(1L, miOrganizacion)));

        List<DonacionResponse> result = donacionService.findDeMisOrganizaciones(1L, 10L);

        assertThat(result).hasSize(1);
        org.mockito.Mockito.verify(donacionRepository).findByOrganizacionId(10L);
    }

    @Test
    void findDeMisOrganizaciones_foreignOrgIdFilter_throwsForbidden() {
        when(organizacionRepository.findByIdAndReferente_Id(20L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> donacionService.findDeMisOrganizaciones(1L, 20L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void findDeMisOrganizaciones_noOrgs_returnsEmptyList() {
        when(donacionRepository.findByOrganizacion_Referente_Id(1L)).thenReturn(List.of());

        List<DonacionResponse> result = donacionService.findDeMisOrganizaciones(1L, null);

        assertThat(result).isEmpty();
    }

    // --- actualizarEstado ownership traversal ---

    @Test
    void actualizarEstado_organizacionWithNullReferente_throwsForbidden() {
        miOrganizacion.setReferente(null);
        Donacion d = donacionFor(1L, miOrganizacion);

        when(donacionRepository.findByIdWithRelations(1L)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> donacionService.actualizarEstado(1L, EstadoDonacion.EN_CAMINO, 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }
}
