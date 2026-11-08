package org.example.acreditacion;

import org.example.domain.EstadoEvidencia;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrganizacionEvidencia;
import org.example.domain.OrganizacionEvidenciaRepository;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEventoOrganizacion;
import org.example.domain.TipoEvidencia;
import org.example.notificacion.NotificacionEvento;
import org.example.user.Administrador;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * RN-04: the daily transition APROBADA -> VENCIDA. Every transition appends one sealed event with
 * actor SISTEMA (the event log is insert-only), is idempotent, never touches the level, and keeps
 * blocking elevation.
 */
@DataJpaTest
@Import({AcreditacionService.class, VigenciaEvidenciaService.class, VigenciaEvidenciaServiceTest.Reloj.class})
@RecordApplicationEvents
class VigenciaEvidenciaServiceTest {

    static final ZoneId ZONA = ZoneId.of("America/Argentina/Buenos_Aires");
    static final LocalDate HOY = LocalDate.of(2026, 11, 8);

    @TestConfiguration
    static class Reloj {
        @Bean
        @org.springframework.context.annotation.Primary
        Clock relojFijo() {
            return Clock.fixed(HOY.atTime(12, 0).atZone(ZONA).toInstant(), ZONA);
        }
    }

    @Autowired private TestEntityManager entityManager;
    @Autowired private AcreditacionService acreditacionService;
    @Autowired private VigenciaEvidenciaService vigencia;
    @Autowired private OrganizacionEvidenciaRepository evidenciaRepository;
    @Autowired private OrganizacionEventoRepository eventoRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private ApplicationEvents events;

    private Organizacion organizacion;
    private Administrador admin;

    @BeforeEach
    void setUp() {
        admin = usuarioRepository.save(new Administrador(null, "Admin", "admin-vig@test.com", "x", true));
        Organizacion o = new Organizacion();
        o.setNombre("Comedor Vigencia");
        o.setSlug("comedor-vigencia-" + System.nanoTime());
        o.setEstado(EstadoOrganizacion.PENDIENTE);
        o.setNivel(NivelAcreditacion.N0);
        organizacion = entityManager.persistFlushFind(o);
    }

    private OrganizacionEvidencia fila(RequisitoAcreditacion requisito, EstadoEvidencia estado, LocalDate validoHasta) {
        OrganizacionEvidencia e = OrganizacionEvidencia.nueva(organizacion, requisito, TipoEvidencia.DECLARACION,
                "d", HOY.minusYears(1), validoHasta, admin.getId());
        e.setEstado(estado);
        e = evidenciaRepository.save(e);
        entityManager.flush();
        return e;
    }

    private List<OrganizacionEvento> eventos() {
        return eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(organizacion.getId());
    }

    @Test
    void anExpiredApprovedEvidenceBecomesVencidaAndAppendsOneSealedSystemEvent() {
        OrganizacionEvidencia e = fila(RequisitoAcreditacion.NO_DISCRIMINACION, EstadoEvidencia.APROBADA,
                HOY.minusDays(1));

        assertThat(vigencia.idsParaVencer()).containsExactly(e.getId());
        assertThat(vigencia.vencer(e.getId())).isTrue();
        entityManager.flush();
        entityManager.clear();

        assertThat(entityManager.find(OrganizacionEvidencia.class, e.getId()).getEstado())
                .isEqualTo(EstadoEvidencia.VENCIDA);
        List<OrganizacionEvento> log = eventos();
        assertThat(log).hasSize(1);
        OrganizacionEvento ev = log.get(0);
        assertThat(ev.getTipo()).isEqualTo(TipoEventoOrganizacion.EVIDENCIA_VENCIDA);
        assertThat(ev.getActorTipo()).isEqualTo("SISTEMA");
        assertThat(ev.getActorUsuarioId()).isNull();
        assertThat(ev.getEvidenciaId()).isEqualTo(e.getId());
        assertThat(ev.getRequisito()).isEqualTo(RequisitoAcreditacion.NO_DISCRIMINACION);
        assertThat(ev.getNivelDespues()).isNull();
        assertThat(ev.getHash()).hasSize(64);
    }

    @Test
    void theTransitionIsIdempotent() {
        OrganizacionEvidencia e = fila(RequisitoAcreditacion.NO_DISCRIMINACION, EstadoEvidencia.APROBADA,
                HOY.minusDays(1));

        assertThat(vigencia.vencer(e.getId())).isTrue();
        assertThat(vigencia.vencer(e.getId())).isFalse();
        assertThat(vigencia.idsParaVencer()).isEmpty();
        assertThat(eventos()).hasSize(1);
    }

    @Test
    void onlyApprovedEvidenceThatEndedBeforeTodayIsMoved() {
        OrganizacionEvidencia venceHoy = fila(RequisitoAcreditacion.NO_DISCRIMINACION, EstadoEvidencia.APROBADA, HOY);
        fila(RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO, EstadoEvidencia.APROBADA, null);
        fila(RequisitoAcreditacion.SEDE_INSCRIPTA_INDIVIDUALMENTE, EstadoEvidencia.PENDIENTE, HOY.minusDays(5));
        fila(RequisitoAcreditacion.SIN_KIOSCO_MISMO_DOMICILIO, EstadoEvidencia.OBSERVADA, HOY.minusDays(5));
        fila(RequisitoAcreditacion.CONDICIONES_SANITARIAS_ADECUADAS, EstadoEvidencia.REEMPLAZADA, HOY.minusDays(5));
        fila(RequisitoAcreditacion.RADIO_50KM_BANCO_ALIMENTOS, EstadoEvidencia.VENCIDA, HOY.minusDays(5));

        assertThat(vigencia.idsParaVencer()).isEmpty();
        assertThat(venceHoy.getEstado()).isEqualTo(EstadoEvidencia.APROBADA);
        assertThat(eventos()).isEmpty();
    }

    @Test
    void expiryNeverChangesTheLevelAndTheReplayStillMatches() {
        organizacion.setNivel(NivelAcreditacion.N1);
        OrganizacionEvidencia e = fila(RequisitoAcreditacion.NO_DISCRIMINACION, EstadoEvidencia.APROBADA,
                HOY.minusDays(1));

        vigencia.vencer(e.getId());
        entityManager.flush();
        entityManager.clear();

        Organizacion recargada = entityManager.find(Organizacion.class, organizacion.getId());
        assertThat(recargada.getNivel()).isEqualTo(NivelAcreditacion.N1);
        assertThat(AcreditacionReplay.reconstruir(eventos())).isEqualTo(NivelAcreditacion.N0);
        assertThat(eventos()).noneMatch(ev -> ev.getNivelDespues() != null);
    }

    @Test
    void aVencidaEvidenceKeepsBlockingElevation() {
        fila(RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO, EstadoEvidencia.APROBADA, HOY.plusMonths(6));
        fila(RequisitoAcreditacion.NO_DISCRIMINACION, EstadoEvidencia.APROBADA, HOY.plusMonths(6));
        OrganizacionEvidencia sede = fila(RequisitoAcreditacion.SEDE_INSCRIPTA_INDIVIDUALMENTE,
                EstadoEvidencia.APROBADA, HOY.minusDays(1));
        vigencia.vencer(sede.getId());
        entityManager.flush();
        entityManager.clear();

        assertThat(acreditacionService.requisitosCompletos(organizacion, NivelAcreditacion.N1)).isFalse();
    }

    @Test
    void theReferenteIsToldWhenAnEvidenceExpiresWithTheGraceDeadline() {
        OrganizacionEvidencia e = fila(RequisitoAcreditacion.NO_DISCRIMINACION, EstadoEvidencia.APROBADA,
                HOY.minusDays(1));

        vigencia.vencer(e.getId());

        List<NotificacionEvento.EvidenciaVencida> enviados = events.stream(NotificacionEvento.EvidenciaVencida.class)
                .toList();
        assertThat(enviados).hasSize(1);
        assertThat(enviados.get(0).organizacionId()).isEqualTo(organizacion.getId());
        assertThat(enviados.get(0).requisito()).isEqualTo(RequisitoAcreditacion.NO_DISCRIMINACION);
        assertThat(enviados.get(0).vencioEl()).isEqualTo(HOY.minusDays(1));
        assertThat(enviados.get(0).graciaHasta()).isEqualTo(HOY.minusDays(1).plusDays(30));
    }

    @Test
    void aSecondRunSendsNoSecondNotification() {
        OrganizacionEvidencia e = fila(RequisitoAcreditacion.NO_DISCRIMINACION, EstadoEvidencia.APROBADA,
                HOY.minusDays(1));
        vigencia.vencer(e.getId());
        vigencia.vencer(e.getId());

        assertThat(events.stream(NotificacionEvento.EvidenciaVencida.class).count()).isEqualTo(1);
    }

    // --- reminder before expiry ------------------------------------------------------------------

    @Test
    void anApprovedEvidenceExpiringWithinTheWindowGetsExactlyOneReminder() {
        OrganizacionEvidencia e = fila(RequisitoAcreditacion.NO_DISCRIMINACION, EstadoEvidencia.APROBADA,
                HOY.plusDays(30));

        assertThat(vigencia.idsParaRecordar()).containsExactly(e.getId());
        assertThat(vigencia.recordar(e.getId())).isTrue();
        assertThat(vigencia.recordar(e.getId())).isFalse();
        assertThat(vigencia.idsParaRecordar()).isEmpty();

        List<NotificacionEvento.EvidenciaPorVencer> enviados = events.stream(NotificacionEvento.EvidenciaPorVencer.class)
                .toList();
        assertThat(enviados).hasSize(1);
        assertThat(enviados.get(0).venceEl()).isEqualTo(HOY.plusDays(30));
        // a reminder is not an accreditation fact: nothing is appended to the event log
        assertThat(eventos()).isEmpty();
    }

    @Test
    void noReminderOutsideTheWindowOrForEvidenceThatIsNotApproved() {
        fila(RequisitoAcreditacion.NO_DISCRIMINACION, EstadoEvidencia.APROBADA, HOY.plusDays(31));
        fila(RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO, EstadoEvidencia.APROBADA, null);
        fila(RequisitoAcreditacion.SEDE_INSCRIPTA_INDIVIDUALMENTE, EstadoEvidencia.PENDIENTE, HOY.plusDays(10));
        fila(RequisitoAcreditacion.SIN_KIOSCO_MISMO_DOMICILIO, EstadoEvidencia.APROBADA, HOY.minusDays(1));

        assertThat(vigencia.idsParaRecordar()).isEmpty();
    }

    @Test
    void replacingTheEvidenceStartsFromAFreshRowThatCanBeRemindedAgain() {
        OrganizacionEvidencia primera = fila(RequisitoAcreditacion.NO_DISCRIMINACION, EstadoEvidencia.APROBADA,
                HOY.plusDays(10));
        vigencia.recordar(primera.getId());

        OrganizacionEvidencia nueva = fila(RequisitoAcreditacion.NO_DISCRIMINACION, EstadoEvidencia.APROBADA,
                HOY.plusDays(20));

        assertThat(vigencia.idsParaRecordar()).containsExactly(nueva.getId());
    }
}
