package org.example.acreditacion;

import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEventoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AD-6: {@code estado}/{@code validada} become a one-function projection of {@code nivel}, and
 * {@code nivelActual} null-coalesces a not-yet-backfilled row to {@code N0}.
 */
@ExtendWith(MockitoExtension.class)
class AcreditacionServiceProjectionTest {

    @Mock
    private OrganizacionEventoRepository eventoRepository;

    @InjectMocks
    private AcreditacionService acreditacionService;

    @Test
    void n0ProjectsToPendienteAndNotValidada() {
        Organizacion organizacion = new Organizacion();
        organizacion.setNivel(NivelAcreditacion.N0);
        organizacion.setEstado(EstadoOrganizacion.PENDIENTE);

        acreditacionService.proyectarEstadoLegacy(organizacion);

        assertThat(organizacion.getEstado()).isEqualTo(EstadoOrganizacion.PENDIENTE);
        assertThat(organizacion.getValidada()).isFalse();
    }

    @Test
    void n1ThroughN3ProjectToAprobadaAndValidada() {
        for (NivelAcreditacion nivel : new NivelAcreditacion[] {
                NivelAcreditacion.N1, NivelAcreditacion.N2, NivelAcreditacion.N3}) {
            Organizacion organizacion = new Organizacion();
            organizacion.setNivel(nivel);
            organizacion.setEstado(EstadoOrganizacion.PENDIENTE);

            acreditacionService.proyectarEstadoLegacy(organizacion);

            assertThat(organizacion.getEstado()).isEqualTo(EstadoOrganizacion.APROBADA);
            assertThat(organizacion.getValidada()).isTrue();
        }
    }

    @Test
    void rechazadaOrgStaysRechazadaRegardlessOfNivel() {
        Organizacion organizacion = new Organizacion();
        organizacion.setNivel(NivelAcreditacion.N0);
        organizacion.setEstado(EstadoOrganizacion.RECHAZADA);

        acreditacionService.proyectarEstadoLegacy(organizacion);

        assertThat(organizacion.getEstado()).isEqualTo(EstadoOrganizacion.RECHAZADA);
    }

    @Test
    void nivelActualNullCoalescesToN0() {
        Organizacion organizacion = new Organizacion();
        organizacion.setNivel(null);

        assertThat(acreditacionService.nivelActual(organizacion)).isEqualTo(NivelAcreditacion.N0);
    }
}
