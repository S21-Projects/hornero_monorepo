package org.example.auth.otp;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Attempt/expiry bookkeeping must survive the {@link ResponseStatusException} that verify throws
 * afterwards. Deliberately NOT {@code @Transactional}: a test-managed transaction would mask a
 * rollback of the service's own transaction, so state is re-read from the repository.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class OtpServiceLockoutIntegrationTest {

    @Autowired private OtpService otpService;
    @Autowired private CodigoVerificacionRepository repository;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private CodigoVerificacion codigo(Instant expiraEn) {
        CodigoVerificacion c = new CodigoVerificacion();
        c.setEmail("otp-lock-" + System.nanoTime() + "@test.com");
        c.setCodigoHash(passwordEncoder.encode("111111"));
        c.setExpiraEn(expiraEn);
        c.setIntentos(0);
        c.setUsado(false);
        c.setCreadoEn(Instant.now());
        return repository.save(c);
    }

    private HttpStatus verifyFailing(String email, String code) {
        try {
            otpService.verify(email, code);
        } catch (ResponseStatusException e) {
            return HttpStatus.valueOf(e.getStatusCode().value());
        }
        throw new AssertionError("expected verify to throw");
    }

    @Test
    void wrongCode_persistsTheAttemptCounter() {
        CodigoVerificacion c = codigo(Instant.now().plus(15, ChronoUnit.MINUTES));

        assertThat(verifyFailing(c.getEmail(), "000000")).isEqualTo(HttpStatus.BAD_REQUEST);

        CodigoVerificacion persisted = repository.findById(c.getId()).orElseThrow();
        assertThat(persisted.getIntentos()).isEqualTo(1);
        assertThat(persisted.isUsado()).isFalse();
    }

    @Test
    void fifthWrongCode_locksTheCode_andTheCorrectCodeIsRefusedAfterwards() {
        CodigoVerificacion c = codigo(Instant.now().plus(15, ChronoUnit.MINUTES));

        for (int i = 0; i < 4; i++) {
            assertThat(verifyFailing(c.getEmail(), "000000")).isEqualTo(HttpStatus.BAD_REQUEST);
        }
        assertThat(verifyFailing(c.getEmail(), "000000")).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);

        CodigoVerificacion persisted = repository.findById(c.getId()).orElseThrow();
        assertThat(persisted.isUsado()).isTrue();
        assertThat(persisted.getIntentos()).isEqualTo(5);

        assertThat(verifyFailing(c.getEmail(), "111111")).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void expiredCode_isMarkedUsed() {
        CodigoVerificacion c = codigo(Instant.now().minus(1, ChronoUnit.MINUTES));

        assertThat(verifyFailing(c.getEmail(), "111111")).isEqualTo(HttpStatus.GONE);

        assertThat(repository.findById(c.getId()).orElseThrow().isUsado()).isTrue();
    }
}
