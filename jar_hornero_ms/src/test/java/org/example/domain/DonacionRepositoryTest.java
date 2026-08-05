package org.example.domain;

import org.example.user.Donante;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;
import java.util.EnumSet;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Repository slice tests for {@link DonacionRepository#findActivas}.
 *
 * Verifies pagination correctness (no cartesian-product inflation from the
 * JOIN FETCH in the `q` search across the donante/necesidad/organizacion
 * relations), the estado filter, and the max-page-size clamp.
 */
@DataJpaTest
class DonacionRepositoryTest {

    @Autowired
    private DonacionRepository donacionRepository;

    @Autowired
    private OrganizacionRepository organizacionRepository;

    @Autowired
    private NecesidadRepository necesidadRepository;

    @Autowired
    private org.example.user.UsuarioRepository usuarioRepository;

    private Donacion crearDonacion(String orgNombre, String donanteNombre, String necesidadDescripcion,
                                    EstadoDonacion estado) {
        Organizacion org = new Organizacion();
        org.setNombre(orgNombre);
        org.setValidada(true);
        org = organizacionRepository.save(org);

        Necesidad necesidad = new Necesidad();
        necesidad.setDescripcion(necesidadDescripcion);
        necesidad.setPrioridad(PrioridadNecesidad.NORMAL);
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setFechaPublicacion(LocalDate.now());
        necesidad.setOrganizacion(org);
        necesidad = necesidadRepository.save(necesidad);

        Donante donante = new Donante();
        donante.setNombre(donanteNombre);
        donante.setEmail(donanteNombre.toLowerCase().replace(" ", ".") + "@test.com");
        donante.setPassword("hash");
        donante.setActivo(true);
        donante = (Donante) usuarioRepository.save(donante);

        Donacion d = new Donacion();
        d.setDonante(donante);
        d.setNecesidad(necesidad);
        d.setEstado(estado);
        d.setFechaOferta(LocalDate.now());
        return donacionRepository.save(d);
    }

    @Test
    void findActivas_qMatchesOrganizacionNombre_returnsCorrectTotalElements() {
        crearDonacion("Caritas Norte", "Juan Perez", "Alimentos", EstadoDonacion.OFRECIDA);
        crearDonacion("Otra Fundacion", "Maria Lopez", "Ropa", EstadoDonacion.ACEPTADA);

        Page<Donacion> page = donacionRepository.findActivas(
                EstadoDonacion.NO_TERMINALES, "caritas", PageRequest.of(0, 20));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent()).hasSize(1);
        assertThat(page.getContent().get(0).getNecesidad().getOrganizacion().getNombre())
                .isEqualTo("Caritas Norte");
    }

    @Test
    void findActivas_qMatchesDonanteNombre_returnsCorrectTotalElements() {
        crearDonacion("Org A", "Juan Perez", "Alimentos", EstadoDonacion.OFRECIDA);
        crearDonacion("Org B", "Maria Lopez", "Ropa", EstadoDonacion.ACEPTADA);

        Page<Donacion> page = donacionRepository.findActivas(
                EstadoDonacion.NO_TERMINALES, "maria", PageRequest.of(0, 20));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).getDonante().getNombre()).isEqualTo("Maria Lopez");
    }

    @Test
    void findActivas_qMatchesNecesidadDescripcion_returnsCorrectTotalElements() {
        crearDonacion("Org A", "Juan Perez", "Alimentos no perecederos", EstadoDonacion.OFRECIDA);
        crearDonacion("Org B", "Maria Lopez", "Ropa de invierno", EstadoDonacion.ACEPTADA);

        Page<Donacion> page = donacionRepository.findActivas(
                EstadoDonacion.NO_TERMINALES, "invierno", PageRequest.of(0, 20));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).getNecesidad().getDescripcion()).isEqualTo("Ropa de invierno");
    }

    @Test
    void findActivas_qMatchesIdSubstring_returnsCorrectTotalElements() {
        Donacion d1 = crearDonacion("Org A", "Juan Perez", "Alimentos", EstadoDonacion.OFRECIDA);
        crearDonacion("Org B", "Maria Lopez", "Ropa", EstadoDonacion.ACEPTADA);

        Page<Donacion> page = donacionRepository.findActivas(
                EstadoDonacion.NO_TERMINALES, String.valueOf(d1.getId()), PageRequest.of(0, 20));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).getId()).isEqualTo(d1.getId());
    }

    @Test
    void findActivas_noQ_returnsAllMatchingEstados_noCartesianInflation() {
        crearDonacion("Org A", "Juan Perez", "Alimentos", EstadoDonacion.OFRECIDA);
        crearDonacion("Org B", "Maria Lopez", "Ropa", EstadoDonacion.ACEPTADA);
        crearDonacion("Org C", "Pedro Gomez", "Agua", EstadoDonacion.ENTREGADA);

        Page<Donacion> page = donacionRepository.findActivas(
                EstadoDonacion.NO_TERMINALES, null, PageRequest.of(0, 20));

        // Only the two non-terminal donations should be returned; the ENTREGADA one is excluded.
        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).hasSize(2);
    }

    @Test
    void findActivas_estadoFilter_restrictsToThatState() {
        crearDonacion("Org A", "Juan Perez", "Alimentos", EstadoDonacion.OFRECIDA);
        crearDonacion("Org B", "Maria Lopez", "Ropa", EstadoDonacion.ACEPTADA);

        Page<Donacion> page = donacionRepository.findActivas(
                EnumSet.of(EstadoDonacion.ACEPTADA), null, PageRequest.of(0, 20));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).getEstado()).isEqualTo(EstadoDonacion.ACEPTADA);
    }

}
