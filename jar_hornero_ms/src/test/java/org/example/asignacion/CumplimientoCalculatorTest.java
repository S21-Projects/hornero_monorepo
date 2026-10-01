package org.example.asignacion;

import org.example.asignacion.worker.dto.CumplimientoV1;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.example.user.Donante;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.context.annotation.Import;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Compliance-history aggregate (AD-11, slice 6b): {@code ENTREGADA} counts as entregada,
 * {@code RECHAZADA} counts as fallida, every {@code CANCELADA} and non-terminal donación is
 * excluded from both (`specs/asignacion-historial-cumplimiento/spec.md`).
 */
@DataJpaTest
@Import(CumplimientoCalculator.class)
class CumplimientoCalculatorTest {

    @Autowired
    private CumplimientoCalculator cumplimientoCalculator;

    @Autowired
    private DonacionRepository donacionRepository;

    @Autowired
    private OrganizacionRepository organizacionRepository;

    @Autowired
    private NecesidadRepository necesidadRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    private Organizacion crearOrganizacion(String nombre) {
        Organizacion org = new Organizacion();
        org.setNombre(nombre);
        org.setValidada(true);
        return organizacionRepository.save(org);
    }

    private Necesidad crearNecesidad(Organizacion org) {
        Necesidad n = new Necesidad();
        n.setOrganizacion(org);
        n.setPrioridad(PrioridadNecesidad.NORMAL);
        n.setEstado(EstadoNecesidad.ABIERTA);
        n.setFechaPublicacion(LocalDate.now());
        return necesidadRepository.save(n);
    }

    private Donante crearDonante(String nombre) {
        Donante d = new Donante();
        d.setNombre(nombre);
        d.setEmail(nombre.toLowerCase().replace(" ", ".") + "@test.com");
        d.setPassword("hash");
        d.setActivo(true);
        return (Donante) usuarioRepository.save(d);
    }

    private void crearDonacion(Donante donante, Necesidad necesidad, EstadoDonacion estado) {
        Donacion d = new Donacion();
        d.setDonante(donante);
        d.setNecesidad(necesidad);
        d.setEstado(estado);
        d.setFechaOferta(LocalDate.now());
        donacionRepository.save(d);
    }

    @Test
    void mixedHistory_entregadaAndRechazadaCounted_canceladaAndEnCaminoExcluded() {
        Organizacion org = crearOrganizacion("Comedor Cumplimiento");
        Necesidad necesidad = crearNecesidad(org);
        Donante donante = crearDonante("Juan Perez");

        for (int i = 0; i < 8; i++) {
            crearDonacion(donante, necesidad, EstadoDonacion.ENTREGADA);
        }
        crearDonacion(donante, necesidad, EstadoDonacion.CANCELADA);
        crearDonacion(donante, necesidad, EstadoDonacion.RECHAZADA);
        crearDonacion(donante, necesidad, EstadoDonacion.EN_CAMINO);
        crearDonacion(donante, necesidad, EstadoDonacion.EN_CAMINO);

        Map<Long, CumplimientoV1> resultado = cumplimientoCalculator.calcular();

        CumplimientoV1 cumplimiento = resultado.get(org.getId());
        assertThat(cumplimiento).isNotNull();
        assertThat(cumplimiento.getEntregadas()).isEqualTo(8);
        assertThat(cumplimiento.getFallidas()).isEqualTo(1);
    }

    @Test
    void organizacionWithoutResolvedHistory_isAbsentFromTheMap() {
        Organizacion org = crearOrganizacion("Comedor Sin Historial");
        Necesidad necesidad = crearNecesidad(org);
        Donante donante = crearDonante("Maria Lopez");
        crearDonacion(donante, necesidad, EstadoDonacion.EN_CAMINO);

        Map<Long, CumplimientoV1> resultado = cumplimientoCalculator.calcular();

        assertThat(resultado).doesNotContainKey(org.getId());
    }

    @Test
    void poolDonationWithoutNecesidad_isExcluded() {
        Donante donante = crearDonante("Sin Necesidad");
        Donacion d = new Donacion();
        d.setDonante(donante);
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setFechaOferta(LocalDate.now());
        donacionRepository.save(d);

        Map<Long, CumplimientoV1> resultado = cumplimientoCalculator.calcular();

        assertThat(resultado).isEmpty();
    }
}
