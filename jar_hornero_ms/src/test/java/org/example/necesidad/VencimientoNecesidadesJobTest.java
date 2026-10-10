package org.example.necesidad;

import org.example.domain.EstadoNecesidad;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * D2/N3: the daily job moves open necesidades past their {@code fechaVencimiento} to VENCIDA.
 * The boundary day itself is still valid ("date == today is NOT expired").
 */
@DataJpaTest
class VencimientoNecesidadesJobTest {

    private static final ZoneId AR = ZoneId.of("America/Argentina/Buenos_Aires");
    private static final LocalDate HOY = LocalDate.of(2026, 10, 10);

    @Autowired
    private NecesidadRepository necesidadRepository;

    @Autowired
    private OrganizacionRepository organizacionRepository;

    private Organizacion org;
    private VencimientoNecesidadesJob job;

    @BeforeEach
    void setUp() {
        org = new Organizacion();
        org.setNombre("Comedor Test");
        org.setValidada(true);
        org = organizacionRepository.save(org);
        // 00:05 Argentina time on HOY.
        Clock clock = Clock.fixed(HOY.atTime(0, 5).atZone(AR).toInstant(), AR);
        job = new VencimientoNecesidadesJob(necesidadRepository, clock);
    }

    private Necesidad necesidad(EstadoNecesidad estado, LocalDate vencimiento) {
        Necesidad n = new Necesidad();
        n.setDescripcion("n");
        n.setPrioridad(PrioridadNecesidad.NORMAL);
        n.setEstado(estado);
        n.setFechaPublicacion(HOY.minusDays(30));
        n.setFechaVencimiento(vencimiento);
        n.setOrganizacion(org);
        return necesidadRepository.saveAndFlush(n);
    }

    private EstadoNecesidad estadoDe(Necesidad n) {
        return necesidadRepository.findById(n.getId()).orElseThrow().getEstado();
    }

    @Test
    void vencerNecesidades_marksOnlyOpenNecesidadesPastTheirDate() {
        Necesidad abiertaVencida = necesidad(EstadoNecesidad.ABIERTA, HOY.minusDays(1));
        Necesidad enProgresoVencida = necesidad(EstadoNecesidad.EN_PROGRESO, HOY.minusDays(10));

        int count = job.vencerNecesidades();

        assertThat(count).isEqualTo(2);
        assertThat(estadoDe(abiertaVencida)).isEqualTo(EstadoNecesidad.VENCIDA);
        assertThat(estadoDe(enProgresoVencida)).isEqualTo(EstadoNecesidad.VENCIDA);
    }

    @Test
    void vencerNecesidades_leavesTodayFutureNullAndClosedUntouched() {
        Necesidad hoy = necesidad(EstadoNecesidad.ABIERTA, HOY);
        Necesidad futura = necesidad(EstadoNecesidad.ABIERTA, HOY.plusDays(1));
        Necesidad sinFecha = necesidad(EstadoNecesidad.ABIERTA, null);
        Necesidad cumplida = necesidad(EstadoNecesidad.CUMPLIDA, HOY.minusDays(5));

        int count = job.vencerNecesidades();

        assertThat(count).isZero();
        assertThat(estadoDe(hoy)).isEqualTo(EstadoNecesidad.ABIERTA);
        assertThat(estadoDe(futura)).isEqualTo(EstadoNecesidad.ABIERTA);
        assertThat(estadoDe(sinFecha)).isEqualTo(EstadoNecesidad.ABIERTA);
        assertThat(estadoDe(cumplida)).isEqualTo(EstadoNecesidad.CUMPLIDA);
    }

    @Test
    void vencerNecesidades_isIdempotent() {
        necesidad(EstadoNecesidad.ABIERTA, HOY.minusDays(1));

        assertThat(job.vencerNecesidades()).isEqualTo(1);
        assertThat(job.vencerNecesidades()).isZero();
    }
}
