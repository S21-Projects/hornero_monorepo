package org.example.domain;

import org.example.user.Donante;
import org.example.user.Referente;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Entity persistence round-trip (AD-9's model), including {@code deficitFuente}, {@code
 * codigoRadio} and the weight/term snapshot columns — 5c.3.
 */
@DataJpaTest
class AsignacionTest {

    @Autowired
    private RondaRepository rondaRepository;

    @Autowired
    private AsignacionRepository asignacionRepository;

    @Autowired
    private org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager entityManager;

    @Test
    void persistsAndReloadsEveryField() {
        Donante donante = new Donante(null, "Donante Test", "donante@test.com", "x", true);
        entityManager.persist(donante);

        Referente referente = new Referente(null, "Ref Test", "ref@test.com", "x", true);
        entityManager.persist(referente);

        Organizacion organizacion = new Organizacion();
        organizacion.setNombre("Comedor Test");
        organizacion.setReferente(referente);
        organizacion.setNivel(NivelAcreditacion.N1);
        organizacion.setLatitud(-31.40);
        organizacion.setLongitud(-64.20);
        entityManager.persist(organizacion);

        Necesidad necesidad = new Necesidad();
        necesidad.setOrganizacion(organizacion);
        necesidad.setPrioridad(PrioridadNecesidad.MEDIA);
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        entityManager.persist(necesidad);

        Donacion donacion = new Donacion();
        donacion.setDonante(donante);
        donacion.setNecesidad(necesidad);
        donacion.setEstado(EstadoDonacion.OFRECIDA);
        donacion.setModalidad(ModalidadDonacion.FONDO_COMUN);
        entityManager.persist(donacion);

        Ronda ronda = new Ronda();
        ronda.setEjecutadaEn(Instant.parse("2026-01-01T10:00:00Z"));
        ronda.setEjecutadaPor(1L);
        ronda.setEstado(EstadoRonda.COMPLETADA);
        ronda.setVersionContrato(1);
        Ronda savedRonda = rondaRepository.saveAndFlush(ronda);

        Asignacion asignacion = new Asignacion();
        asignacion.setRonda(savedRonda);
        asignacion.setDonacion(donacion);
        asignacion.setNecesidad(necesidad);
        asignacion.setOrganizacion(organizacion);
        asignacion.setEstado(EstadoAsignacion.PROPUESTA);
        asignacion.setCreadaEn(Instant.parse("2026-01-01T10:00:01Z"));
        asignacion.setScore(0.71);
        asignacion.setCostoOportunidad(0.0);
        asignacion.setDistanciaKm(2.1);
        asignacion.setTerminoDeficit(0.33);
        asignacion.setTerminoUrgencia(0.6);
        asignacion.setTerminoProximidad(0.77);
        asignacion.setTerminoEspera(0.16);
        asignacion.setTerminoCumplimiento(null);
        asignacion.setDeficitFuente("NEUTRAL");
        asignacion.setCodigoRadio("");

        Asignacion saved = asignacionRepository.saveAndFlush(asignacion);
        Asignacion reloaded = asignacionRepository.findById(saved.getId()).orElseThrow();

        assertThat(reloaded.getRonda().getId()).isEqualTo(savedRonda.getId());
        assertThat(reloaded.getDonacion().getId()).isEqualTo(donacion.getId());
        assertThat(reloaded.getNecesidad().getId()).isEqualTo(necesidad.getId());
        assertThat(reloaded.getOrganizacion().getId()).isEqualTo(organizacion.getId());
        assertThat(reloaded.getEstado()).isEqualTo(EstadoAsignacion.PROPUESTA);
        assertThat(reloaded.getCreadaEn()).isEqualTo(Instant.parse("2026-01-01T10:00:01Z"));
        assertThat(reloaded.getResueltaEn()).isNull();
        assertThat(reloaded.getScore()).isEqualTo(0.71);
        assertThat(reloaded.getCostoOportunidad()).isEqualTo(0.0);
        assertThat(reloaded.getDistanciaKm()).isEqualTo(2.1);
        assertThat(reloaded.getTerminoDeficit()).isEqualTo(0.33);
        assertThat(reloaded.getTerminoUrgencia()).isEqualTo(0.6);
        assertThat(reloaded.getTerminoProximidad()).isEqualTo(0.77);
        assertThat(reloaded.getTerminoEspera()).isEqualTo(0.16);
        assertThat(reloaded.getTerminoCumplimiento()).isNull();
        assertThat(reloaded.getDeficitFuente()).isEqualTo("NEUTRAL");
        assertThat(reloaded.getCodigoRadio()).isEqualTo("");
    }
}
