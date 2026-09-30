package org.example.donacion.entrega;

import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.Necesidad;
import org.example.domain.Organizacion;
import org.example.donacion.ParticipantesDonacion;
import org.example.donacion.entrega.dto.CodigoEntregaResponse;
import org.example.donacion.entrega.dto.EntregaEstadoResponse;
import org.example.user.Donante;
import org.example.user.Referente;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Mirrors {@code OtpServiceTest} (AD-6): same hash/TTL/throttle/attempt-lockout shape, but scoped
 * to one donación and two parties (donante/referente) instead of one email, and gated by
 * {@code ParticipantesDonacion}/mutual verification instead of a single-sided flag.
 */
@ExtendWith(MockitoExtension.class)
class EntregaServiceTest {

    private static final Long DONACION_ID = 10L;
    private static final Long DONANTE_ID = 2L;
    private static final Long REFERENTE_ID = 1L;

    @Mock
    private DonacionRepository donacionRepository;

    @Mock
    private CodigoEntregaRepository codigoEntregaRepository;

    @Mock
    private CodigoEntregaThrottle throttle;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private Instant now;
    private EntregaService entregaService;

    @BeforeEach
    void setUp() {
        now = Instant.parse("2026-01-01T00:00:00Z");
        Clock clock = Clock.fixed(now, ZoneOffset.UTC);
        entregaService = new EntregaService(donacionRepository, codigoEntregaRepository, throttle, passwordEncoder, clock);
        ReflectionTestUtils.setField(entregaService, "ttlMinutes", 10L);
        ReflectionTestUtils.setField(entregaService, "maxAttempts", 5);
    }

    private Donacion donacionActiva(EstadoDonacion estado) {
        Donante donante = new Donante(DONANTE_ID, "Donante Test", "donante@test.com", "x", true);
        Referente referente = new Referente(REFERENTE_ID, "Ref Test", "ref@test.com", "x", true);
        Organizacion organizacion = new Organizacion();
        organizacion.setReferente(referente);
        Necesidad necesidad = new Necesidad();
        necesidad.setOrganizacion(organizacion);

        Donacion d = new Donacion();
        d.setId(DONACION_ID);
        d.setDonante(donante);
        d.setNecesidad(necesidad);
        d.setEstado(estado);
        return d;
    }

    private CodigoEntrega codigo(String plaintext, ParticipantesDonacion.Parte emisorParte, Long emisorId,
                                  Instant expiraEn, int intentos) {
        CodigoEntrega c = new CodigoEntrega();
        c.setDonacion(donacionActiva(EstadoDonacion.EN_CAMINO));
        c.setEmisorId(emisorId);
        c.setEmisorParte(emisorParte);
        c.setCodigoHash(passwordEncoder.encode(plaintext));
        c.setExpiraEn(expiraEn);
        c.setIntentos(intentos);
        c.setUsado(false);
        c.setCreadoEn(now);
        return c;
    }

    // --- generar ---

    @Test
    void generar_persistsHashedCodeWith10MinTtl_andReturnsPlaintextOnce() {
        Donacion d = donacionActiva(EstadoDonacion.EN_CAMINO);
        when(donacionRepository.findByIdWithRelations(DONACION_ID)).thenReturn(Optional.of(d));
        when(codigoEntregaRepository.findByDonacion_IdAndEmisorIdAndUsadoFalse(DONACION_ID, DONANTE_ID))
                .thenReturn(List.of());
        when(codigoEntregaRepository.save(any(CodigoEntrega.class))).thenAnswer(inv -> inv.getArgument(0));

        CodigoEntregaResponse response = entregaService.generar(DONACION_ID, DONANTE_ID);

        assertThat(response.codigo()).matches("\\d{6}");
        assertThat(response.expiraEn()).isEqualTo(now.plusSeconds(10 * 60));

        ArgumentCaptor<CodigoEntrega> captor = ArgumentCaptor.forClass(CodigoEntrega.class);
        verify(codigoEntregaRepository).save(captor.capture());
        CodigoEntrega saved = captor.getValue();
        assertThat(saved.getEmisorId()).isEqualTo(DONANTE_ID);
        assertThat(saved.getEmisorParte()).isEqualTo(ParticipantesDonacion.Parte.DONANTE);
        assertThat(saved.isUsado()).isFalse();
        assertThat(saved.getCodigoHash()).isNotBlank();
        assertThat(passwordEncoder.matches(response.codigo(), saved.getCodigoHash())).isTrue();
    }

    @Test
    void generar_regenerate_burnsPreviousUnusedCodeImmediately() {
        Donacion d = donacionActiva(EstadoDonacion.EN_CAMINO);
        CodigoEntrega previo = codigo("111111", ParticipantesDonacion.Parte.DONANTE, DONANTE_ID,
                now.plusSeconds(300), 0);

        when(donacionRepository.findByIdWithRelations(DONACION_ID)).thenReturn(Optional.of(d));
        when(codigoEntregaRepository.findByDonacion_IdAndEmisorIdAndUsadoFalse(DONACION_ID, DONANTE_ID))
                .thenReturn(List.of(previo));
        when(codigoEntregaRepository.save(any(CodigoEntrega.class))).thenAnswer(inv -> inv.getArgument(0));

        entregaService.generar(DONACION_ID, DONANTE_ID);

        assertThat(previo.isUsado()).isTrue();
        verify(codigoEntregaRepository, times(2)).save(any(CodigoEntrega.class));
    }

    @Test
    void generar_throttleRejects_propagates429_andNeverPersists() {
        Donacion d = donacionActiva(EstadoDonacion.EN_CAMINO);
        when(donacionRepository.findByIdWithRelations(DONACION_ID)).thenReturn(Optional.of(d));
        doThrow(new ResponseStatusException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS, "ESPERA_ANTES_DE_REENVIAR"))
                .when(throttle).checkAndRecord(DONACION_ID, DONANTE_ID);

        assertThatThrownBy(() -> entregaService.generar(DONACION_ID, DONANTE_ID))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("429")
                .hasMessageContaining("ESPERA_ANTES_DE_REENVIAR");

        verify(codigoEntregaRepository, times(0)).save(any());
    }

    @Test
    void generar_counterpartAlreadyValidatedThisPartysCode_throws409() {
        Donacion d = donacionActiva(EstadoDonacion.PENDIENTE_CONFIRMACION);
        // referente already verified the donante's code -> confirmadaReferenteEn is set.
        d.setConfirmadaReferenteEn(now.minusSeconds(60));

        when(donacionRepository.findByIdWithRelations(DONACION_ID)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> entregaService.generar(DONACION_ID, DONANTE_ID))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409")
                .hasMessageContaining("YA_CONFIRMADO");

        verify(codigoEntregaRepository, times(0)).save(any());
    }

    @Test
    void generar_nonParty_throws403() {
        Donacion d = donacionActiva(EstadoDonacion.EN_CAMINO);
        when(donacionRepository.findByIdWithRelations(DONACION_ID)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> entregaService.generar(DONACION_ID, 999L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    // --- verificar ---

    @Test
    void verificar_wrongPartysOwnCode_rejected() {
        // The donante's own code cannot verify itself (only the referente presenting it counts).
        Donacion d = donacionActiva(EstadoDonacion.EN_CAMINO);
        CodigoEntrega propio = codigo("123456", ParticipantesDonacion.Parte.DONANTE, DONANTE_ID,
                now.plusSeconds(300), 0);

        when(donacionRepository.findByIdForUpdate(DONACION_ID)).thenReturn(Optional.of(d));
        // The donante verifies -> looks up the REFERENTE's code, not its own. None exists.
        when(codigoEntregaRepository.findTopByDonacion_IdAndEmisorParteAndUsadoFalseOrderByCreadoEnDesc(
                DONACION_ID, ParticipantesDonacion.Parte.REFERENTE)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> entregaService.verificar(DONACION_ID, DONANTE_ID, "123456"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400")
                .hasMessageContaining("CODIGO_INVALIDO");
    }

    @Test
    void verificar_expiredCode_throws410_withoutConsumingAttempt() {
        Donacion d = donacionActiva(EstadoDonacion.EN_CAMINO);
        CodigoEntrega delReferente = codigo("654321", ParticipantesDonacion.Parte.REFERENTE, REFERENTE_ID,
                now.minusSeconds(1), 0);

        when(donacionRepository.findByIdForUpdate(DONACION_ID)).thenReturn(Optional.of(d));
        when(codigoEntregaRepository.findTopByDonacion_IdAndEmisorParteAndUsadoFalseOrderByCreadoEnDesc(
                DONACION_ID, ParticipantesDonacion.Parte.REFERENTE)).thenReturn(Optional.of(delReferente));

        assertThatThrownBy(() -> entregaService.verificar(DONACION_ID, DONANTE_ID, "654321"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("410")
                .hasMessageContaining("CODIGO_EXPIRADO");

        assertThat(delReferente.isUsado()).isTrue();
        assertThat(delReferente.getIntentos()).isZero();
    }

    @Test
    void verificar_fifthWrongAttempt_burnsCodeWith429() {
        Donacion d = donacionActiva(EstadoDonacion.EN_CAMINO);
        CodigoEntrega delReferente = codigo("654321", ParticipantesDonacion.Parte.REFERENTE, REFERENTE_ID,
                now.plusSeconds(300), 4);

        when(donacionRepository.findByIdForUpdate(DONACION_ID)).thenReturn(Optional.of(d));
        when(codigoEntregaRepository.findTopByDonacion_IdAndEmisorParteAndUsadoFalseOrderByCreadoEnDesc(
                DONACION_ID, ParticipantesDonacion.Parte.REFERENTE)).thenReturn(Optional.of(delReferente));

        assertThatThrownBy(() -> entregaService.verificar(DONACION_ID, DONANTE_ID, "000000"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("429")
                .hasMessageContaining("DEMASIADOS_INTENTOS");

        assertThat(delReferente.isUsado()).isTrue();
        assertThat(delReferente.getIntentos()).isEqualTo(5);
    }

    @Test
    void verificar_correctCodeAfterFewerWrongAttempts_succeeds() {
        Donacion d = donacionActiva(EstadoDonacion.EN_CAMINO);
        CodigoEntrega delReferente = codigo("654321", ParticipantesDonacion.Parte.REFERENTE, REFERENTE_ID,
                now.plusSeconds(300), 2);

        when(donacionRepository.findByIdForUpdate(DONACION_ID)).thenReturn(Optional.of(d));
        when(codigoEntregaRepository.findTopByDonacion_IdAndEmisorParteAndUsadoFalseOrderByCreadoEnDesc(
                DONACION_ID, ParticipantesDonacion.Parte.REFERENTE)).thenReturn(Optional.of(delReferente));

        EntregaEstadoResponse response = entregaService.verificar(DONACION_ID, DONANTE_ID, "654321");

        assertThat(delReferente.isUsado()).isTrue();
        assertThat(response.estado()).isEqualTo(EstadoDonacion.PENDIENTE_CONFIRMACION.name());
    }

    @Test
    void verificar_success_setsVerifiersOwnConfirmationTimestamp() {
        Donacion d = donacionActiva(EstadoDonacion.EN_CAMINO);
        CodigoEntrega delReferente = codigo("654321", ParticipantesDonacion.Parte.REFERENTE, REFERENTE_ID,
                now.plusSeconds(300), 0);

        when(donacionRepository.findByIdForUpdate(DONACION_ID)).thenReturn(Optional.of(d));
        when(codigoEntregaRepository.findTopByDonacion_IdAndEmisorParteAndUsadoFalseOrderByCreadoEnDesc(
                DONACION_ID, ParticipantesDonacion.Parte.REFERENTE)).thenReturn(Optional.of(delReferente));

        entregaService.verificar(DONACION_ID, DONANTE_ID, "654321");

        assertThat(d.getConfirmadaDonanteEn()).isEqualTo(now);
        assertThat(d.getConfirmadaReferenteEn()).isNull();
    }

    @Test
    void verificar_firstVerification_movesToPendienteConfirmacion() {
        Donacion d = donacionActiva(EstadoDonacion.EN_CAMINO);
        CodigoEntrega delReferente = codigo("654321", ParticipantesDonacion.Parte.REFERENTE, REFERENTE_ID,
                now.plusSeconds(300), 0);

        when(donacionRepository.findByIdForUpdate(DONACION_ID)).thenReturn(Optional.of(d));
        when(codigoEntregaRepository.findTopByDonacion_IdAndEmisorParteAndUsadoFalseOrderByCreadoEnDesc(
                DONACION_ID, ParticipantesDonacion.Parte.REFERENTE)).thenReturn(Optional.of(delReferente));

        entregaService.verificar(DONACION_ID, DONANTE_ID, "654321");

        assertThat(d.getEstado()).isEqualTo(EstadoDonacion.PENDIENTE_CONFIRMACION);
        assertThat(d.getFechaEntrega()).isNull();
    }

    @Test
    void verificar_secondVerification_movesToEntregada_andSetsFechaEntrega() {
        Donacion d = donacionActiva(EstadoDonacion.PENDIENTE_CONFIRMACION);
        d.setConfirmadaReferenteEn(now.minusSeconds(120)); // referente already verified the donante's code
        CodigoEntrega delReferente = codigo("654321", ParticipantesDonacion.Parte.REFERENTE, REFERENTE_ID,
                now.plusSeconds(300), 0);

        when(donacionRepository.findByIdForUpdate(DONACION_ID)).thenReturn(Optional.of(d));
        when(codigoEntregaRepository.findTopByDonacion_IdAndEmisorParteAndUsadoFalseOrderByCreadoEnDesc(
                DONACION_ID, ParticipantesDonacion.Parte.REFERENTE)).thenReturn(Optional.of(delReferente));

        EntregaEstadoResponse response = entregaService.verificar(DONACION_ID, DONANTE_ID, "654321");

        assertThat(d.getEstado()).isEqualTo(EstadoDonacion.ENTREGADA);
        assertThat(d.getFechaEntrega()).isNotNull();
        assertThat(response.estado()).isEqualTo(EstadoDonacion.ENTREGADA.name());
    }

    @Test
    void verificar_reVerifyingOwnAlreadySatisfiedSide_isIdempotent200() {
        Donacion d = donacionActiva(EstadoDonacion.PENDIENTE_CONFIRMACION);
        d.setConfirmadaDonanteEn(now.minusSeconds(60)); // donante already verified

        when(donacionRepository.findByIdForUpdate(DONACION_ID)).thenReturn(Optional.of(d));

        EntregaEstadoResponse response = entregaService.verificar(DONACION_ID, DONANTE_ID, "000000");

        assertThat(response.estado()).isEqualTo(EstadoDonacion.PENDIENTE_CONFIRMACION.name());
        verify(codigoEntregaRepository, times(0))
                .findTopByDonacion_IdAndEmisorParteAndUsadoFalseOrderByCreadoEnDesc(anyLong(), any());
    }

    @Test
    void verificar_nonParty_throws403() {
        Donacion d = donacionActiva(EstadoDonacion.EN_CAMINO);
        when(donacionRepository.findByIdForUpdate(DONACION_ID)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> entregaService.verificar(DONACION_ID, 999L, "654321"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void verificar_donationWithNullNecesidad_hasNoReferenteParty_noNpe() {
        Donante donante = new Donante(DONANTE_ID, "Donante Test", "donante@test.com", "x", true);
        Donacion d = new Donacion();
        d.setId(DONACION_ID);
        d.setDonante(donante);
        d.setNecesidad(null);
        d.setEstado(EstadoDonacion.EN_CAMINO);

        when(donacionRepository.findByIdForUpdate(DONACION_ID)).thenReturn(Optional.of(d));

        assertThatThrownBy(() -> entregaService.verificar(DONACION_ID, REFERENTE_ID, "654321"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }
}
