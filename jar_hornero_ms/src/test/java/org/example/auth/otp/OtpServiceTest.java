package org.example.auth.otp;

import org.example.mail.Mailer;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OtpServiceTest {

    @Mock
    private CodigoVerificacionRepository codigoVerificacionRepository;

    @Mock
    private OtpThrottle otpThrottle;

    @Mock
    private Mailer mailer;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private Instant now;
    private OtpService otpService;

    @BeforeEach
    void setUp() {
        now = Instant.parse("2026-01-01T00:00:00Z");
        Clock clock = Clock.fixed(now, ZoneOffset.UTC);
        otpService = new OtpService(codigoVerificacionRepository, otpThrottle, mailer, passwordEncoder, clock);
        ReflectionTestUtils.setField(otpService, "ttlMinutes", 15L);
        ReflectionTestUtils.setField(otpService, "maxAttempts", 5);
    }

    // --- issue ---

    @Test
    void issue_persistsHashedCodeWith15MinTtl_andSendsMail() {
        when(codigoVerificacionRepository.save(any(CodigoVerificacion.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        otpService.issue("user@test.com");

        ArgumentCaptor<CodigoVerificacion> captor = ArgumentCaptor.forClass(CodigoVerificacion.class);
        verify(codigoVerificacionRepository).save(captor.capture());
        CodigoVerificacion saved = captor.getValue();

        assertThat(saved.getEmail()).isEqualTo("user@test.com");
        assertThat(saved.isUsado()).isFalse();
        assertThat(saved.getIntentos()).isZero();
        assertThat(saved.getExpiraEn()).isEqualTo(now.plusSeconds(15 * 60));
        assertThat(saved.getCodigoHash()).isNotBlank();
        verify(mailer).enviarOtp(eq("user@test.com"), anyString());
    }

    @Test
    void issue_mailerThrows_doesNotPropagate() {
        when(codigoVerificacionRepository.save(any(CodigoVerificacion.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        org.mockito.Mockito.doThrow(new RuntimeException("resend down"))
                .when(mailer).enviarOtp(anyString(), anyString());

        org.assertj.core.api.Assertions.assertThatCode(() -> otpService.issue("user@test.com"))
                .doesNotThrowAnyException();

        verify(codigoVerificacionRepository).save(any(CodigoVerificacion.class));
    }

    // --- verify ---

    @Test
    void verify_correctCodeWithinTtl_marksSingleUse() {
        String codigo = "123456";
        CodigoVerificacion registro = registro(codigo, now.plusSeconds(60), 0);

        when(codigoVerificacionRepository.findTopByEmailAndUsadoFalseOrderByCreadoEnDesc("user@test.com"))
                .thenReturn(Optional.of(registro));

        otpService.verify("user@test.com", codigo);

        assertThat(registro.isUsado()).isTrue();
    }

    @Test
    void verify_expiredCode_throws410AndInvalidates() {
        CodigoVerificacion registro = registro("123456", now.minusSeconds(1), 0);

        when(codigoVerificacionRepository.findTopByEmailAndUsadoFalseOrderByCreadoEnDesc("user@test.com"))
                .thenReturn(Optional.of(registro));

        assertThatThrownBy(() -> otpService.verify("user@test.com", "123456"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("410")
                .hasMessageContaining("CODIGO_EXPIRADO");

        assertThat(registro.isUsado()).isTrue();
    }

    @Test
    void verify_fifthIncorrectAttempt_invalidatesCode() {
        CodigoVerificacion registro = registro("123456", now.plusSeconds(600), 4);

        when(codigoVerificacionRepository.findTopByEmailAndUsadoFalseOrderByCreadoEnDesc("user@test.com"))
                .thenReturn(Optional.of(registro));

        assertThatThrownBy(() -> otpService.verify("user@test.com", "000000"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("429")
                .hasMessageContaining("DEMASIADOS_INTENTOS");

        assertThat(registro.isUsado()).isTrue();
        assertThat(registro.getIntentos()).isEqualTo(5);
    }

    @Test
    void verify_incorrectAttemptBelowLockout_incrementsAndStaysUsable() {
        CodigoVerificacion registro = registro("123456", now.plusSeconds(600), 1);

        when(codigoVerificacionRepository.findTopByEmailAndUsadoFalseOrderByCreadoEnDesc("user@test.com"))
                .thenReturn(Optional.of(registro));

        assertThatThrownBy(() -> otpService.verify("user@test.com", "000000"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400")
                .hasMessageContaining("CODIGO_INVALIDO");

        assertThat(registro.isUsado()).isFalse();
        assertThat(registro.getIntentos()).isEqualTo(2);
    }

    @Test
    void verify_noPendingCode_throws400() {
        when(codigoVerificacionRepository.findTopByEmailAndUsadoFalseOrderByCreadoEnDesc("user@test.com"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> otpService.verify("user@test.com", "000000"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400")
                .hasMessageContaining("CODIGO_INVALIDO");
    }

    // --- resend ---

    @Test
    void resend_throttlesInvalidatesPriorAndIssuesFreshCode() {
        CodigoVerificacion prior = registro("111111", now.plusSeconds(600), 0);

        when(codigoVerificacionRepository.findTopByEmailAndUsadoFalseOrderByCreadoEnDesc("user@test.com"))
                .thenReturn(Optional.of(prior));
        when(codigoVerificacionRepository.save(any(CodigoVerificacion.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        otpService.resend("user@test.com");

        verify(otpThrottle).checkAndRecord("user@test.com");
        assertThat(prior.isUsado()).isTrue();
        verify(codigoVerificacionRepository, times(2)).save(any(CodigoVerificacion.class));
    }

    @Test
    void resend_throttleRejects_neverIssuesNewCode() {
        org.mockito.Mockito.doThrow(new ResponseStatusException(
                        org.springframework.http.HttpStatus.TOO_MANY_REQUESTS, "ESPERA_ANTES_DE_REENVIAR"))
                .when(otpThrottle).checkAndRecord("user@test.com");

        assertThatThrownBy(() -> otpService.resend("user@test.com"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("429");

        org.mockito.Mockito.verifyNoInteractions(codigoVerificacionRepository);
    }

    private CodigoVerificacion registro(String codigo, Instant expiraEn, int intentos) {
        CodigoVerificacion c = new CodigoVerificacion();
        c.setEmail("user@test.com");
        c.setCodigoHash(passwordEncoder.encode(codigo));
        c.setExpiraEn(expiraEn);
        c.setIntentos(intentos);
        c.setUsado(false);
        c.setCreadoEn(now);
        return c;
    }
}
