package org.example.domain;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** The grouped aggregate behind the live ronda vulnerability (spec ronda-vulnerabilidad-viva). */
@DataJpaTest
class PoblacionRadioRepositoryTest {

    private static final LocalDate HOY = LocalDate.of(2026, 10, 10);
    private static final List<String> ESTADOS_ORG = List.of("APROBADA", "SIN_RECLAMAR");
    private static final List<String> ESTADOS_NEC = List.of("ABIERTA", "EN_PROGRESO");

    @Autowired
    private PoblacionRadioRepository repository;

    @Autowired
    private OrganizacionRepository organizacionRepository;

    @Autowired
    private NecesidadRepository necesidadRepository;

    @Autowired
    private JdbcTemplate jdbc;

    private Organizacion organizacion(EstadoOrganizacion estado, String radio, boolean conCoordenadas) {
        Organizacion o = new Organizacion();
        o.setNombre("Comedor " + estado + " " + radio);
        o.setValidada(true);
        o.setEstado(estado);
        o.setCodigoRadio(radio);
        if (conCoordenadas) {
            o.setLatitud(-31.4);
            o.setLongitud(-64.2);
        }
        return organizacionRepository.saveAndFlush(o);
    }

    private void necesidad(Organizacion org, EstadoNecesidad estado, LocalDate vencimiento) {
        Necesidad n = new Necesidad();
        n.setDescripcion("n");
        n.setPrioridad(PrioridadNecesidad.NORMAL);
        n.setEstado(estado);
        n.setFechaPublicacion(HOY.minusDays(30));
        n.setFechaVencimiento(vencimiento);
        n.setOrganizacion(org);
        necesidadRepository.saveAndFlush(n);
    }

    private void poblacion(String radio, int habitantes) {
        jdbc.update("insert into poblacion_radio (codigo_radio, habitantes) values (?, ?)", radio, habitantes);
    }

    @Test
    void zonasConComedores_countsOnlyLiveComedoresAndOpenNecesidadesOfRadiosWithPopulation() {
        poblacion("020010101", 1000);
        poblacion("020010102", 800);      // only a PENDIENTE organizacion
        poblacion("020010104", 0);        // zero population
        // 020010103 has a comedor but no population row.

        Organizacion a = organizacion(EstadoOrganizacion.APROBADA, "020010101", true);
        organizacion(EstadoOrganizacion.SIN_RECLAMAR, "020010101", true);
        organizacion(EstadoOrganizacion.INACTIVA, "020010101", true);
        organizacion(EstadoOrganizacion.APROBADA, "020010101", false);   // no coordinates
        organizacion(EstadoOrganizacion.APROBADA, null, true);            // no radio
        necesidad(a, EstadoNecesidad.ABIERTA, null);
        necesidad(a, EstadoNecesidad.EN_PROGRESO, HOY);
        necesidad(a, EstadoNecesidad.ABIERTA, HOY.minusDays(1));          // expired
        necesidad(a, EstadoNecesidad.CUMPLIDA, null);                     // closed

        organizacion(EstadoOrganizacion.PENDIENTE, "020010102", true);
        organizacion(EstadoOrganizacion.APROBADA, "020010103", true);
        organizacion(EstadoOrganizacion.APROBADA, "020010104", true);

        List<Object[]> filas = repository.zonasConComedores(ESTADOS_ORG, ESTADOS_NEC, HOY);

        assertThat(filas).hasSize(1);
        Object[] fila = filas.get(0);
        assertThat(fila[0]).isEqualTo("020010101");
        assertThat(((Number) fila[1]).longValue()).isEqualTo(1000L);
        assertThat(((Number) fila[2]).longValue()).isEqualTo(2L);   // APROBADA + SIN_RECLAMAR with coords
        assertThat(((Number) fila[3]).longValue()).isEqualTo(2L);   // ABIERTA + EN_PROGRESO not expired
    }
}
