package org.example.donacion;

import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.domain.Asignacion;
import org.example.domain.AsignacionRepository;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoAsignacion;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.EstadoRonda;
import org.example.domain.ModalidadDonacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.example.domain.Ronda;
import org.example.domain.RondaRepository;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

/**
 * N12/D4: the daily stale-donations job. Real repositories and real transactions (no test-level
 * transaction): the per-row transaction boundaries are part of what is being tested.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class DonacionesEstancadasJobTest {

    private static final ZoneId AR = ZoneId.of("America/Argentina/Buenos_Aires");
    private static final Instant AHORA = Instant.parse("2026-10-12T15:00:00Z");

    @Autowired
    private DonacionRepository donacionRepository;
    @Autowired
    private AsignacionRepository asignacionRepository;
    @Autowired
    private NecesidadRepository necesidadRepository;
    @Autowired
    private OrganizacionRepository organizacionRepository;
    @Autowired
    private UsuarioRepository usuarioRepository;
    @Autowired
    private RondaRepository rondaRepository;
    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @SpyBean
    private DonacionService donacionService;
    @SpyBean
    private ActividadService actividadService;

    private DonacionesEstancadasJob job;
    private Donante donante;
    private Organizacion org;
    private Necesidad necesidad;
    private Ronda ronda;

    @BeforeEach
    void setUp() {
        String s = UUID.randomUUID().toString().substring(0, 8);
        Referente referente = (Referente) usuarioRepository.save(
                new Referente(null, "Ref " + s, "ref-" + s + "@test.com", "hash", true));
        donante = (Donante) usuarioRepository.save(
                new Donante(null, "Don " + s, "don-" + s + "@test.com", "hash", true));
        org = new Organizacion();
        org.setNombre("Org " + s);
        org.setValidada(true);
        org.setNivel(NivelAcreditacion.N1);
        org.setReferente(referente);
        org = organizacionRepository.save(org);
        necesidad = new Necesidad();
        necesidad.setOrganizacion(org);
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setPrioridad(PrioridadNecesidad.MEDIA);
        necesidad.setFechaVencimiento(LocalDate.of(2027, 1, 1));
        necesidad = necesidadRepository.save(necesidad);
        ronda = new Ronda();
        ronda.setEjecutadaEn(AHORA.minus(Duration.ofDays(30)));
        ronda.setEjecutadaPor(1L);
        ronda.setEstado(EstadoRonda.COMPLETADA);
        ronda.setVersionContrato(1);
        ronda = rondaRepository.save(ronda);

        Mockito.reset(donacionService, actividadService);
        job = new DonacionesEstancadasJob(donacionRepository, asignacionRepository, donacionService,
                Clock.fixed(AHORA, AR), actividadService, VentanasDonacion.POR_DEFECTO);
    }

    private Donacion donacion(EstadoDonacion estado, ModalidadDonacion modalidad, boolean conNecesidad, Duration hace) {
        Donacion d = new Donacion();
        d.setDonante(donante);
        d.setEstado(estado);
        d.setModalidad(modalidad);
        d.setFechaOferta(LocalDate.of(2026, 1, 1));
        d.setEstadoDesde(AHORA.minus(hace));
        if (conNecesidad) {
            d.setNecesidad(necesidad);
        }
        return donacionRepository.save(d);
    }

    private Asignacion propuesta(Donacion d, Duration hace) {
        Asignacion a = new Asignacion();
        a.setRonda(ronda);
        a.setDonacion(d);
        a.setNecesidad(necesidad);
        a.setOrganizacion(org);
        a.setEstado(EstadoAsignacion.PROPUESTA);
        a.setCreadaEn(AHORA.minus(hace));
        return asignacionRepository.save(a);
    }

    private Donacion recargar(Donacion d) {
        return donacionRepository.findByIdWithRelations(d.getId()).orElseThrow();
    }

    // ── DIRECTA OFRECIDA without an answer ───────────────────────────────────────────────

    @Test
    void directaOfrecidaOlderThanSevenDays_isCancelledBySystem() {
        Donacion vieja = donacion(EstadoDonacion.OFRECIDA, ModalidadDonacion.DIRECTA, true,
                Duration.ofDays(7).plusHours(1));

        DonacionesEstancadasJob.Resumen r = job.ejecutar();

        assertThat(r.canceladas()).isGreaterThanOrEqualTo(1);
        Donacion recargada = recargar(vieja);
        assertThat(recargada.getEstado()).isEqualTo(EstadoDonacion.CANCELADA);
        assertThat(recargada.getEstadoDesde()).isNotNull().isAfter(AHORA.minus(Duration.ofDays(8)));

        ArgumentCaptor<ActividadService.Registro> c = ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService, atLeastOnce()).registrar(c.capture());
        ActividadService.Registro fila = c.getAllValues().stream()
                .filter(x -> x.accion() == TipoActividad.DONACION_VENCIDA && vieja.getId().equals(x.entidadId()))
                .findFirst().orElseThrow();
        assertThat(fila.esSistema()).isTrue();
        assertThat(fila.antes()).isEqualTo("OFRECIDA");
        assertThat(fila.despues()).isEqualTo("CANCELADA");
        assertThat(fila.motivo()).isEqualTo("sin respuesta del referente");
    }

    @Test
    void directaOfrecida_atExactlySevenDays_isNotYetCancelled() {
        Donacion limite = donacion(EstadoDonacion.OFRECIDA, ModalidadDonacion.DIRECTA, true, Duration.ofDays(7));
        Donacion reciente = donacion(EstadoDonacion.OFRECIDA, ModalidadDonacion.DIRECTA, true, Duration.ofDays(2));

        job.ejecutar();

        assertThat(recargar(limite).getEstado()).isEqualTo(EstadoDonacion.OFRECIDA);
        assertThat(recargar(reciente).getEstado()).isEqualTo(EstadoDonacion.OFRECIDA);
    }

    @Test
    void legacyDirectaWithNullModalidadAndNullEstadoDesde_usesFechaOfertaFallback() {
        Donacion legacy = new Donacion();
        legacy.setDonante(donante);
        legacy.setNecesidad(necesidad);
        legacy.setEstado(EstadoDonacion.OFRECIDA);
        legacy.setModalidad(null);
        legacy.setFechaOferta(LocalDate.of(2026, 10, 1)); // 11 days before AHORA
        legacy = donacionRepository.saveAndFlush(legacy);
        // simulate a row that predates the column (the PrePersist default filled it)
        jdbcTemplate.update("UPDATE donaciones SET estado_desde = NULL WHERE id = ?", legacy.getId());

        job.ejecutar();

        assertThat(recargar(legacy).getEstado()).isEqualTo(EstadoDonacion.CANCELADA);
    }

    @Test
    void fondoComunOfrecidaInThePool_isLeftAlone() {
        Donacion enPozo = donacion(EstadoDonacion.OFRECIDA, ModalidadDonacion.FONDO_COMUN, false, Duration.ofDays(60));

        job.ejecutar();

        assertThat(recargar(enPozo).getEstado()).isEqualTo(EstadoDonacion.OFRECIDA);
    }

    @Test
    void aceptadaEnCaminoAndPendiente_areNeverAutoCancelled_howeverOld() {
        Donacion aceptada = donacion(EstadoDonacion.ACEPTADA, ModalidadDonacion.DIRECTA, true, Duration.ofDays(90));
        Donacion enCamino = donacion(EstadoDonacion.EN_CAMINO, ModalidadDonacion.DIRECTA, true, Duration.ofDays(90));
        Donacion pendiente = donacion(EstadoDonacion.PENDIENTE_CONFIRMACION, ModalidadDonacion.DIRECTA, true, Duration.ofDays(90));

        job.ejecutar();

        assertThat(recargar(aceptada).getEstado()).isEqualTo(EstadoDonacion.ACEPTADA);
        assertThat(recargar(enCamino).getEstado()).isEqualTo(EstadoDonacion.EN_CAMINO);
        assertThat(recargar(pendiente).getEstado()).isEqualTo(EstadoDonacion.PENDIENTE_CONFIRMACION);
    }

    // ── pool asignacion PROPUESTA without an answer ──────────────────────────────────────

    @Test
    void propuestaOlderThanThreeDays_isTreatedAsRejection_donationBackInThePool() {
        Donacion asignada = donacion(EstadoDonacion.OFRECIDA, ModalidadDonacion.FONDO_COMUN, true, Duration.ofDays(5));
        Asignacion vigente = propuesta(asignada, Duration.ofDays(3).plusHours(1));

        DonacionesEstancadasJob.Resumen r = job.ejecutar();

        assertThat(r.propuestasVencidas()).isGreaterThanOrEqualTo(1);
        Donacion recargada = recargar(asignada);
        assertThat(recargada.getEstado()).isEqualTo(EstadoDonacion.OFRECIDA);
        assertThat(recargada.getNecesidad()).isNull();
        Asignacion resuelta = asignacionRepository.findById(vigente.getId()).orElseThrow();
        assertThat(resuelta.getEstado()).isEqualTo(EstadoAsignacion.RECHAZADA);
        assertThat(resuelta.getResueltaEn()).isNotNull();
        // the necesidad keeps the donation in its collection graph: it must not have been deleted
        assertThat(donacionRepository.existsById(asignada.getId())).isTrue();

        ArgumentCaptor<ActividadService.Registro> c = ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService, atLeastOnce()).registrar(c.capture());
        ActividadService.Registro fila = c.getAllValues().stream()
                .filter(x -> x.accion() == TipoActividad.DONACION_PROPUESTA_VENCIDA && asignada.getId().equals(x.entidadId()))
                .findFirst().orElseThrow();
        assertThat(fila.esSistema()).isTrue();
        assertThat(fila.motivo()).isEqualTo("sin respuesta del referente");
    }

    @Test
    void propuestaAtExactlyThreeDaysOrRecent_isNotExpired() {
        Donacion enElLimite = donacion(EstadoDonacion.OFRECIDA, ModalidadDonacion.FONDO_COMUN, true, Duration.ofDays(5));
        Asignacion a1 = propuesta(enElLimite, Duration.ofDays(3));
        Donacion reciente = donacion(EstadoDonacion.OFRECIDA, ModalidadDonacion.FONDO_COMUN, true, Duration.ofDays(1));
        Asignacion a2 = propuesta(reciente, Duration.ofDays(1));

        job.ejecutar();

        assertThat(recargar(enElLimite).getNecesidad()).isNotNull();
        assertThat(recargar(reciente).getNecesidad()).isNotNull();
        assertThat(asignacionRepository.findById(a1.getId()).orElseThrow().getEstado()).isEqualTo(EstadoAsignacion.PROPUESTA);
        assertThat(asignacionRepository.findById(a2.getId()).orElseThrow().getEstado()).isEqualTo(EstadoAsignacion.PROPUESTA);
    }

    @Test
    void propuestaOfADonationTheReferenteAlreadyAccepted_isNotTouched() {
        // stale candidate: the donation moved on (ACEPTADA) so the PROPUESTA row is not the vigente answer
        Donacion aceptada = donacion(EstadoDonacion.ACEPTADA, ModalidadDonacion.FONDO_COMUN, true, Duration.ofDays(5));
        propuesta(aceptada, Duration.ofDays(10));

        boolean actuo = donacionService.expirarPropuesta(aceptada.getId(), AHORA.minus(Duration.ofDays(3)));

        assertThat(actuo).isFalse();
        assertThat(recargar(aceptada).getNecesidad()).isNotNull();
        assertThat(recargar(aceptada).getEstado()).isEqualTo(EstadoDonacion.ACEPTADA);
    }

    // ── concurrency / robustness ─────────────────────────────────────────────────────────

    @Test
    void userActionThatWonTheRace_makesTheJobStepANoOp() {
        Donacion vieja = donacion(EstadoDonacion.OFRECIDA, ModalidadDonacion.DIRECTA, true, Duration.ofDays(9));
        donacionService.actualizarEstado(vieja.getId(), EstadoDonacion.CANCELADA, donante.getId());

        boolean actuo = donacionService.cancelarOfertaSinRespuesta(vieja.getId(), AHORA.minus(Duration.ofDays(7)));

        assertThat(actuo).isFalse();
        assertThat(recargar(vieja).getEstado()).isEqualTo(EstadoDonacion.CANCELADA);
    }

    @Test
    void optimisticConflictOnOneRow_isSkippedAndTheRestStillProcessed() {
        Donacion conflictiva = donacion(EstadoDonacion.OFRECIDA, ModalidadDonacion.DIRECTA, true, Duration.ofDays(9));
        Donacion sana = donacion(EstadoDonacion.OFRECIDA, ModalidadDonacion.DIRECTA, true, Duration.ofDays(9));
        doThrow(new ObjectOptimisticLockingFailureException(Donacion.class, conflictiva.getId()))
                .when(donacionService).cancelarOfertaSinRespuesta(eq(conflictiva.getId()), any());

        DonacionesEstancadasJob.Resumen r = job.ejecutar();

        assertThat(r.conflictos()).isEqualTo(1);
        assertThat(recargar(conflictiva).getEstado()).isEqualTo(EstadoDonacion.OFRECIDA);
        assertThat(recargar(sana).getEstado()).isEqualTo(EstadoDonacion.CANCELADA);
    }

    @Test
    void run_recordsOneSystemSummaryRowWithCounts_andIsIdempotent() {
        donacion(EstadoDonacion.OFRECIDA, ModalidadDonacion.DIRECTA, true, Duration.ofDays(9));
        Donacion asignada = donacion(EstadoDonacion.OFRECIDA, ModalidadDonacion.FONDO_COMUN, true, Duration.ofDays(9));
        propuesta(asignada, Duration.ofDays(4));

        DonacionesEstancadasJob.Resumen primera = job.ejecutar();

        ArgumentCaptor<ActividadService.Registro> c = ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService, atLeastOnce()).registrar(c.capture());
        List<ActividadService.Registro> resumenes = c.getAllValues().stream()
                .filter(x -> x.accion() == TipoActividad.DONACIONES_ESTANCADAS_PROCESADAS).toList();
        assertThat(resumenes).hasSize(1);
        assertThat(resumenes.get(0).esSistema()).isTrue();
        assertThat(resumenes.get(0).detalle()).contains(String.valueOf(primera.canceladas()))
                .contains(String.valueOf(primera.propuestasVencidas()));

        DonacionesEstancadasJob.Resumen segunda = job.ejecutar();
        assertThat(segunda.canceladas()).isZero();
        assertThat(segunda.propuestasVencidas()).isZero();
    }
}
