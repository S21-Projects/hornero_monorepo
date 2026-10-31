package org.example.domain;

import org.example.user.Donante;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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

    private static final ZoneId AR = ZoneId.of("America/Argentina/Buenos_Aires");
    private static final Instant AHORA = Instant.parse("2026-10-12T15:00:00Z");
    private static final Instant CORTE = AHORA;
    private static final LocalDate FECHA = LocalDate.of(2000, 1, 1);

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

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

        Page<Donacion> page = donacionRepository.findActivas(EstadoDonacion.NO_TERMINALES, "caritas", false, CORTE, FECHA, CORTE, FECHA, PageRequest.of(0, 20));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent()).hasSize(1);
        assertThat(page.getContent().get(0).getNecesidad().getOrganizacion().getNombre())
                .isEqualTo("Caritas Norte");
    }

    @Test
    void findActivas_qMatchesDonanteNombre_returnsCorrectTotalElements() {
        crearDonacion("Org A", "Juan Perez", "Alimentos", EstadoDonacion.OFRECIDA);
        crearDonacion("Org B", "Maria Lopez", "Ropa", EstadoDonacion.ACEPTADA);

        Page<Donacion> page = donacionRepository.findActivas(EstadoDonacion.NO_TERMINALES, "maria", false, CORTE, FECHA, CORTE, FECHA, PageRequest.of(0, 20));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).getDonante().getNombre()).isEqualTo("Maria Lopez");
    }

    @Test
    void findActivas_qMatchesNecesidadDescripcion_returnsCorrectTotalElements() {
        crearDonacion("Org A", "Juan Perez", "Alimentos no perecederos", EstadoDonacion.OFRECIDA);
        crearDonacion("Org B", "Maria Lopez", "Ropa de invierno", EstadoDonacion.ACEPTADA);

        Page<Donacion> page = donacionRepository.findActivas(EstadoDonacion.NO_TERMINALES, "invierno", false, CORTE, FECHA, CORTE, FECHA, PageRequest.of(0, 20));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).getNecesidad().getDescripcion()).isEqualTo("Ropa de invierno");
    }

    @Test
    void findActivas_qMatchesIdSubstring_returnsCorrectTotalElements() {
        Donacion d1 = crearDonacion("Org A", "Juan Perez", "Alimentos", EstadoDonacion.OFRECIDA);
        crearDonacion("Org B", "Maria Lopez", "Ropa", EstadoDonacion.ACEPTADA);

        Page<Donacion> page = donacionRepository.findActivas(EstadoDonacion.NO_TERMINALES, String.valueOf(d1.getId()), false, CORTE, FECHA, CORTE, FECHA, PageRequest.of(0, 20));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).getId()).isEqualTo(d1.getId());
    }

    @Test
    void findActivas_noQ_returnsAllMatchingEstados_noCartesianInflation() {
        crearDonacion("Org A", "Juan Perez", "Alimentos", EstadoDonacion.OFRECIDA);
        crearDonacion("Org B", "Maria Lopez", "Ropa", EstadoDonacion.ACEPTADA);
        crearDonacion("Org C", "Pedro Gomez", "Agua", EstadoDonacion.ENTREGADA);

        Page<Donacion> page = donacionRepository.findActivas(EstadoDonacion.NO_TERMINALES, null, false, CORTE, FECHA, CORTE, FECHA, PageRequest.of(0, 20));

        // Only the two non-terminal donations should be returned; the ENTREGADA one is excluded.
        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).hasSize(2);
    }

    @Test
    void findActivas_estadoFilter_restrictsToThatState() {
        crearDonacion("Org A", "Juan Perez", "Alimentos", EstadoDonacion.OFRECIDA);
        crearDonacion("Org B", "Maria Lopez", "Ropa", EstadoDonacion.ACEPTADA);

        Page<Donacion> page = donacionRepository.findActivas(EnumSet.of(EstadoDonacion.ACEPTADA), null, false, CORTE, FECHA, CORTE, FECHA, PageRequest.of(0, 20));

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

        Page<Donacion> page = donacionRepository.findActivas(EstadoDonacion.NO_TERMINALES, null, false, CORTE, FECHA, CORTE, FECHA, PageRequest.of(0, 20));

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


    @Test
    void findByOrganizacion_Referente_Id_pagesOnlyDonationsOfThatReferentesOrgs_withTotalCount() {
        org.example.user.Referente referente = new org.example.user.Referente();
        referente.setNombre("Ref Paginado");
        referente.setEmail("ref.paginado@test.com");
        referente.setPassword("hash");
        referente.setActivo(true);
        referente = (org.example.user.Referente) usuarioRepository.save(referente);
        for (int i = 0; i < 3; i++) {
            Donacion d = crearDonacion("Org Ref " + i, "Donante Ref " + i, "n", EstadoDonacion.OFRECIDA);
            Organizacion org = d.getNecesidad().getOrganizacion();
            org.setReferente(referente);
            organizacionRepository.saveAndFlush(org);
        }
        crearDonacion("Org Ajena", "Donante Ajeno", "n", EstadoDonacion.OFRECIDA);

        Page<Donacion> primera = donacionRepository.findByOrganizacion_Referente_Id(referente.getId(), PageRequest.of(0, 2));
        Page<Donacion> segunda = donacionRepository.findByOrganizacion_Referente_Id(referente.getId(), PageRequest.of(1, 2));

        assertThat(primera.getTotalElements()).isEqualTo(3);
        assertThat(primera.getContent()).hasSize(2);
        assertThat(segunda.getContent()).hasSize(1);
    }


    // ── N12: estancadas filter ──────────────────────────────────────────────────────────────

    private Donacion conEstadoDesde(EstadoDonacion estado, Duration hace) {
        Donacion d = crearDonacion("Org " + estado + hace, "Don " + estado + hace.toHours(), "n", estado);
        d.setEstadoDesde(AHORA.minus(hace));
        return donacionRepository.saveAndFlush(d);
    }

    private List<Long> estancadas() {
        Instant corteEnCurso = AHORA.minus(Duration.ofDays(14));
        Instant corteConfirmacion = AHORA.minus(Duration.ofDays(7));
        return donacionRepository.findActivas(EstadoDonacion.NO_TERMINALES, null, true,
                        corteEnCurso, Donacion.fechaLimiteFallback(corteEnCurso, AR),
                        corteConfirmacion, Donacion.fechaLimiteFallback(corteConfirmacion, AR),
                        PageRequest.of(0, 50))
                .map(Donacion::getId).getContent();
    }

    @Test
    void findActivas_soloEstancadas_returnsOnlyStaleOnesPerStateWindow() {
        Donacion aceptadaVieja = conEstadoDesde(EstadoDonacion.ACEPTADA, Duration.ofDays(15));
        Donacion enCaminoVieja = conEstadoDesde(EstadoDonacion.EN_CAMINO, Duration.ofDays(20));
        Donacion aceptadaFresca = conEstadoDesde(EstadoDonacion.ACEPTADA, Duration.ofDays(10));
        Donacion pendienteVieja = conEstadoDesde(EstadoDonacion.PENDIENTE_CONFIRMACION, Duration.ofDays(8));
        Donacion pendienteFresca = conEstadoDesde(EstadoDonacion.PENDIENTE_CONFIRMACION, Duration.ofDays(6));
        Donacion ofrecidaVieja = conEstadoDesde(EstadoDonacion.OFRECIDA, Duration.ofDays(100));

        List<Long> ids = estancadas();

        assertThat(ids).contains(aceptadaVieja.getId(), enCaminoVieja.getId(), pendienteVieja.getId());
        assertThat(ids).doesNotContain(aceptadaFresca.getId(), pendienteFresca.getId(), ofrecidaVieja.getId());
    }

    @Test
    void findActivas_soloEstancadas_exactBoundaryIsNotYetStale() {
        Donacion enElLimite = conEstadoDesde(EstadoDonacion.ACEPTADA, Duration.ofDays(14));

        assertThat(estancadas()).doesNotContain(enElLimite.getId());
    }

    @Test
    void findActivas_soloEstancadas_nullEstadoDesdeFallsBackToFechaOferta() {
        Donacion legacy = crearDonacion("Org legacy", "Don legacy", "n", EstadoDonacion.ACEPTADA);
        legacy.setFechaOferta(LocalDate.of(2026, 9, 1));
        donacionRepository.saveAndFlush(legacy);
        jdbcTemplate.update("UPDATE donaciones SET estado_desde = NULL WHERE id = ?", legacy.getId());
        Donacion legacyFresca = crearDonacion("Org legacy2", "Don legacy2", "n", EstadoDonacion.ACEPTADA);
        legacyFresca.setFechaOferta(LocalDate.of(2026, 10, 10));
        donacionRepository.saveAndFlush(legacyFresca);
        jdbcTemplate.update("UPDATE donaciones SET estado_desde = NULL WHERE id = ?", legacyFresca.getId());

        List<Long> ids = estancadas();

        assertThat(ids).contains(legacy.getId()).doesNotContain(legacyFresca.getId());
    }

    @Test
    void findActivas_withoutTheFlag_ignoresTheWindows() {
        Donacion fresca = conEstadoDesde(EstadoDonacion.ACEPTADA, Duration.ofDays(1));

        Page<Donacion> page = donacionRepository.findActivas(EstadoDonacion.NO_TERMINALES, null, false,
                AHORA, FECHA, AHORA, FECHA, PageRequest.of(0, 50));

        assertThat(page.getContent()).extracting(Donacion::getId).contains(fresca.getId());
    }
}
