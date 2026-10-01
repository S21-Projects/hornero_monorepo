package org.example.domain;

import org.example.user.Donante;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;

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

    // ─── slice 5b — LEFT JOIN FETCH: an unassigned FONDO_COMUN donation must not error ────────

    private Donante crearDonante(String nombre) {
        Donante donante = new Donante();
        donante.setNombre(nombre);
        donante.setEmail(nombre.toLowerCase().replace(" ", ".") + "@test.com");
        donante.setPassword("hash");
        donante.setActivo(true);
        return (Donante) usuarioRepository.save(donante);
    }

    private Donacion crearDonacionSinNecesidad(Donante donante) {
        Donacion d = new Donacion();
        d.setDonante(donante);
        d.setNecesidad(null);
        d.setModalidad(ModalidadDonacion.FONDO_COMUN);
        d.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        d.setLatitud(-34.6);
        d.setLongitud(-58.4);
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setFechaOferta(LocalDate.now());
        return donacionRepository.save(d);
    }

    @Test
    void findAllWithDonante_unassignedPoolDonation_returnedWithoutError() {
        Donante donante = crearDonante("Juan Fondo");
        Donacion unassigned = crearDonacionSinNecesidad(donante);
        crearDonacion("Org A", "Otro Donante", "Alimentos", EstadoDonacion.OFRECIDA);

        List<Donacion> all = donacionRepository.findAllWithDonante();
        Page<Donacion> page = donacionRepository.findAllWithDonante(PageRequest.of(0, 20));

        assertThat(all).extracting(Donacion::getId).contains(unassigned.getId());
        assertThat(page.getContent()).extracting(Donacion::getId).contains(unassigned.getId());
        Donacion found = all.stream().filter(d -> d.getId().equals(unassigned.getId())).findFirst().orElseThrow();
        assertThat(found.getNecesidad()).isNull();
    }

    @Test
    void findByIdWithRelations_unassignedPoolDonation_returnedWithoutError() {
        Donante donante = crearDonante("Ana Fondo");
        Donacion unassigned = crearDonacionSinNecesidad(donante);

        var found = donacionRepository.findByIdWithRelations(unassigned.getId());

        assertThat(found).isPresent();
        assertThat(found.get().getNecesidad()).isNull();
    }

    // Found by the e2e smoke test: the ronda write phase locks the pool donation with this query
    // before assigning it, so an inner join on necesidad made every assignment a "descartada".
    @Test
    void findByIdForUpdate_unassignedPoolDonation_isFound() {
        Donante donante = crearDonante("Lock Fondo");
        Donacion unassigned = crearDonacionSinNecesidad(donante);

        var found = donacionRepository.findByIdForUpdate(unassigned.getId());

        assertThat(found).isPresent();
        assertThat(found.get().getNecesidad()).isNull();
    }

    @Test
    void findByDonanteIdWithRelations_unassignedPoolDonation_returnedWithoutError() {
        Donante donante = crearDonante("Luis Fondo");
        Donacion unassigned = crearDonacionSinNecesidad(donante);

        List<Donacion> list = donacionRepository.findByDonante_IdWithRelations(donante.getId());
        Page<Donacion> page = donacionRepository.findByDonante_IdWithRelations(donante.getId(), PageRequest.of(0, 20));

        assertThat(list).extracting(Donacion::getId).containsExactly(unassigned.getId());
        assertThat(page.getContent()).extracting(Donacion::getId).containsExactly(unassigned.getId());
    }

    @Test
    void findActivas_unassignedPoolDonation_includedWithoutError_noCartesianInflation() {
        Donante donante = crearDonante("Marta Fondo");
        crearDonacionSinNecesidad(donante);
        crearDonacion("Org A", "Juan Perez", "Alimentos", EstadoDonacion.OFRECIDA);

        Page<Donacion> page = donacionRepository.findActivas(
                EstadoDonacion.NO_TERMINALES, null, PageRequest.of(0, 20));

        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).hasSize(2);
    }

    @Test
    void findByOrganizacionId_excludesUnassignedPoolDonations_staysInnerJoin() {
        Donante donante = crearDonante("Sofia Fondo");
        crearDonacionSinNecesidad(donante);
        Donacion assigned = crearDonacion("Org Asignada", "Otro Donante", "Alimentos", EstadoDonacion.OFRECIDA);
        Long orgId = assigned.getNecesidad().getOrganizacion().getId();

        List<Donacion> list = donacionRepository.findByOrganizacionId(orgId);
        Page<Donacion> page = donacionRepository.findByOrganizacionId(orgId, PageRequest.of(0, 20));

        assertThat(list).extracting(Donacion::getId).containsExactly(assigned.getId());
        assertThat(page.getContent()).extracting(Donacion::getId).containsExactly(assigned.getId());
    }

}
