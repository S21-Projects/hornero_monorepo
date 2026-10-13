package org.example.donacion;

import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.ModalidadDonacion;
import org.example.user.Donante;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * N15/D12 (policy 1.4): thirty days after a donation reaches a terminal state its coordinates are
 * rounded to two decimals (~1 km). Rounding is HALF_UP on the decimal value and idempotent.
 */
@DataJpaTest
class CoordenadasMinimizacionJobTest {

    private static final ZoneId AR = ZoneId.of("America/Argentina/Buenos_Aires");
    private static final Instant AHORA = Instant.parse("2026-10-13T12:00:00Z");

    @Autowired
    private DonacionRepository donacionRepository;
    @Autowired
    private UsuarioRepository usuarioRepository;

    private final ActividadService actividadService = Mockito.mock(ActividadService.class);
    private CoordenadasMinimizacionJob job;
    private Donante donante;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(AHORA, AR);
        CoordenadasMinimizacionService service = new CoordenadasMinimizacionService(donacionRepository);
        job = new CoordenadasMinimizacionJob(donacionRepository, service, clock, actividadService, 30L, 2);
        donante = usuarioRepository.save(new Donante(null, "Dora", "d-" + UUID.randomUUID() + "@t.com", "x", true));
    }

    private Donacion donacion(EstadoDonacion estado, Instant estadoDesde, Double lat, Double lon) {
        Donacion d = new Donacion();
        d.setFechaOferta(LocalDate.of(2026, 1, 1));
        d.setEstado(estado);
        d.setEstadoDesde(estadoDesde);
        d.setDonante(donante);
        d.setModalidad(ModalidadDonacion.FONDO_COMUN);
        d.setLatitud(lat);
        d.setLongitud(lon);
        return donacionRepository.saveAndFlush(d);
    }

    private Donacion recargar(Donacion d) {
        donacionRepository.flush();
        return donacionRepository.findById(d.getId()).orElseThrow();
    }

    private static Instant hace(long dias) {
        return AHORA.minus(Duration.ofDays(dias));
    }

    @Test
    void terminalDonationsOlderThanTheWindow_getTwoDecimals() {
        Donacion entregada = donacion(EstadoDonacion.ENTREGADA, hace(31), -34.603722, -58.381592);
        Donacion rechazada = donacion(EstadoDonacion.RECHAZADA, hace(90), -31.4201, -64.1888);
        Donacion cancelada = donacion(EstadoDonacion.CANCELADA, hace(45), -32.9468, -60.6393);

        int n = job.ejecutar();

        assertThat(n).isEqualTo(3);
        assertThat(recargar(entregada).getLatitud()).isEqualTo(-34.60);
        assertThat(recargar(entregada).getLongitud()).isEqualTo(-58.38);
        assertThat(recargar(rechazada).getLatitud()).isEqualTo(-31.42);
        assertThat(recargar(rechazada).getLongitud()).isEqualTo(-64.19);
        assertThat(recargar(cancelada).getLatitud()).isEqualTo(-32.95);
        assertThat(recargar(cancelada).getLongitud()).isEqualTo(-60.64);
    }

    @Test
    void halfUpOnTheDecimalValue() {
        Donacion d = donacion(EstadoDonacion.ENTREGADA, hace(40), 10.125, -10.125);

        job.ejecutar();

        assertThat(recargar(d).getLatitud()).isEqualTo(10.13);
        assertThat(recargar(d).getLongitud()).isEqualTo(-10.13);
    }

    @Test
    void boundary_exactlyThirtyDaysIsKept_oneSecondOlderIsRounded() {
        Donacion justo = donacion(EstadoDonacion.ENTREGADA, hace(30), -34.603722, -58.381592);
        Donacion pasado = donacion(EstadoDonacion.ENTREGADA, hace(30).minusSeconds(1), -34.603722, -58.381592);

        job.ejecutar();

        assertThat(recargar(justo).getLatitud()).isEqualTo(-34.603722);
        assertThat(recargar(pasado).getLatitud()).isEqualTo(-34.60);
    }

    @Test
    void recentOrInFlightDonations_areUntouched() {
        Donacion reciente = donacion(EstadoDonacion.ENTREGADA, hace(5), -34.603722, -58.381592);
        Donacion enCurso = donacion(EstadoDonacion.EN_CAMINO, hace(100), -34.603722, -58.381592);
        Donacion ofrecida = donacion(EstadoDonacion.OFRECIDA, hace(100), -34.603722, -58.381592);
        Donacion pendiente = donacion(EstadoDonacion.PENDIENTE_CONFIRMACION, hace(100), -34.603722, -58.381592);

        int n = job.ejecutar();

        assertThat(n).isZero();
        for (Donacion d : new Donacion[]{reciente, enCurso, ofrecida, pendiente}) {
            assertThat(recargar(d).getLatitud()).isEqualTo(-34.603722);
            assertThat(recargar(d).getLongitud()).isEqualTo(-58.381592);
        }
    }

    @Test
    void nullEstadoDesde_fallsBackToFechaOferta() {
        Donacion vieja = donacion(EstadoDonacion.ENTREGADA, null, -34.603722, -58.381592);
        // @PrePersist stamps estadoDesde; clear it to mimic a row that predates the column.
        vieja.setEstadoDesde(null);
        donacionRepository.saveAndFlush(vieja);

        job.ejecutar();

        assertThat(recargar(vieja).getLatitud()).isEqualTo(-34.60);
    }

    @Test
    void isIdempotent_andAlreadyRoundedValuesStay() {
        Donacion d = donacion(EstadoDonacion.ENTREGADA, hace(40), -34.603722, -58.381592);
        Donacion yaRedondeada = donacion(EstadoDonacion.ENTREGADA, hace(40), -34.61, -58.39);

        assertThat(job.ejecutar()).isEqualTo(1);
        assertThat(job.ejecutar()).isZero();

        assertThat(recargar(d).getLatitud()).isEqualTo(-34.60);
        assertThat(recargar(yaRedondeada).getLatitud()).isEqualTo(-34.61);
        assertThat(recargar(yaRedondeada).getLongitud()).isEqualTo(-58.39);
    }

    @Test
    void donationsWithoutCoordinates_areIgnored() {
        donacion(EstadoDonacion.ENTREGADA, hace(40), null, null);

        assertThat(job.ejecutar()).isZero();
    }

    @Test
    void processesInBatches_andRecordsOneSystemSummary() {
        for (int i = 0; i < 5; i++) {
            donacion(EstadoDonacion.ENTREGADA, hace(40 + i), -34.603722 - i, -58.381592);
        }

        int n = job.ejecutar();

        assertThat(n).isEqualTo(5);
        ArgumentCaptor<ActividadService.Registro> captor = ArgumentCaptor.forClass(ActividadService.Registro.class);
        Mockito.verify(actividadService).registrar(captor.capture());
        assertThat(captor.getValue().accion()).isEqualTo(TipoActividad.COORDENADAS_MINIMIZADAS);
        assertThat(captor.getValue().esSistema()).isTrue();
        assertThat(captor.getValue().detalle()).contains("5");
        assertThat(captor.getValue().detalle()).doesNotContain("34.6");

        Mockito.clearInvocations(actividadService);
        job.ejecutar();
        Mockito.verify(actividadService, Mockito.never()).registrar(ArgumentMatchers.any());
    }
}
