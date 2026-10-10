package org.example.auth.otp;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.mail.Mailer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

/**
 * Owns the OTP lifecycle: issue (generate + hash + persist + send),
 * resend (throttle + invalidate + reissue), verify (match + single-use +
 * attempt lockout). The MS is the sole authority for this state — never the
 * JWT claim (design decision #5).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OtpService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final CodigoVerificacionRepository codigoVerificacionRepository;
    private final OtpThrottle otpThrottle;
    private final Mailer mailer;
    private final BCryptPasswordEncoder passwordEncoder;
    private final Clock clock;

    @Value("${app.otp.ttl-minutes}")
    private long ttlMinutes;

    @Value("${app.otp.max-attempts}")
    private int maxAttempts;

    @Transactional
    public void issue(String email) {
        String codigo = generarCodigo();
        CodigoVerificacion registro = new CodigoVerificacion();
        registro.setEmail(normalize(email));
        registro.setCodigoHash(passwordEncoder.encode(codigo));
        registro.setExpiraEn(clock.instant().plus(ttlMinutes, ChronoUnit.MINUTES));
        registro.setIntentos(0);
        registro.setUsado(false);
        registro.setCreadoEn(clock.instant());
        codigoVerificacionRepository.save(registro);

        try {
            mailer.enviarOtp(email, codigo);
        } catch (Exception e) {
            log.error("[otp] Fallo al enviar el código a {}: {}", email, e.getMessage());
        }
    }

    @Transactional
    public void resend(String email) {
        otpThrottle.checkAndRecord(email);
        invalidatePendiente(email);
        issue(email);
    }

    /**
     * Validates the submitted code. Returns normally on success (caller sets
     * {@code emailVerificado = true}); throws otherwise. {@code noRollbackFor}: attempts, lockout
     * and expiry are persisted before the exception is thrown and must survive it.
     */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public void verify(String email, String codigo) {
        CodigoVerificacion registro = codigoVerificacionRepository
                .findTopByEmailAndUsadoFalseOrderByCreadoEnDesc(normalize(email))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "CODIGO_INVALIDO"));

        if (registro.getExpiraEn().isBefore(clock.instant())) {
            registro.setUsado(true);
            codigoVerificacionRepository.save(registro);
            throw new ResponseStatusException(HttpStatus.GONE, "CODIGO_EXPIRADO");
        }

        if (!passwordEncoder.matches(codigo, registro.getCodigoHash())) {
            registro.setIntentos(registro.getIntentos() + 1);
            if (registro.getIntentos() >= maxAttempts) {
                registro.setUsado(true);
                codigoVerificacionRepository.save(registro);
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "DEMASIADOS_INTENTOS");
            }
            codigoVerificacionRepository.save(registro);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CODIGO_INVALIDO");
        }

        registro.setUsado(true);
        codigoVerificacionRepository.save(registro);
    }

    private void invalidatePendiente(String email) {
        Optional<CodigoVerificacion> pendiente =
                codigoVerificacionRepository.findTopByEmailAndUsadoFalseOrderByCreadoEnDesc(normalize(email));
        pendiente.ifPresent(c -> {
            c.setUsado(true);
            codigoVerificacionRepository.save(c);
        });
    }

    private String generarCodigo() {
        int value = RANDOM.nextInt(1_000_000);
        return String.format("%06d", value);
    }

    private String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
