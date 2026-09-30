package org.example.donacion.entrega;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory resend/regenerate throttle keyed by {@code donacionId:emisorId}, mirroring
 * {@code OtpThrottle}'s sliding window + cooldown algorithm exactly (AD-6).
 */
@Component
public class CodigoEntregaThrottle {

    private final Clock clock;
    private final int maxRequests;
    private final long windowMinutes;
    private final long cooldownSeconds;

    private final ConcurrentHashMap<String, Deque<Instant>> history = new ConcurrentHashMap<>();

    public CodigoEntregaThrottle(
            Clock clock,
            @Value("${app.entrega.generar-max}") int maxRequests,
            @Value("${app.entrega.generar-window-minutes}") long windowMinutes,
            @Value("${app.entrega.generar-cooldown-seconds}") long cooldownSeconds) {
        this.clock = clock;
        this.maxRequests = maxRequests;
        this.windowMinutes = windowMinutes;
        this.cooldownSeconds = cooldownSeconds;
    }

    /**
     * Throws 429 ESPERA_ANTES_DE_REENVIAR if the cooldown hasn't elapsed or the window cap has
     * been reached; otherwise records this request.
     */
    public void checkAndRecord(Long donacionId, Long emisorId) {
        String key = key(donacionId, emisorId);
        Instant now = clock.instant();
        Instant windowStart = now.minus(windowMinutes, ChronoUnit.MINUTES);

        history.compute(key, (k, existing) -> {
            Deque<Instant> deque = existing != null ? existing : new ArrayDeque<>();
            while (!deque.isEmpty() && deque.peekFirst().isBefore(windowStart)) {
                deque.pollFirst();
            }
            if (!deque.isEmpty()) {
                long secondsSinceLast = Duration.between(deque.peekLast(), now).getSeconds();
                if (secondsSinceLast < cooldownSeconds) {
                    throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "ESPERA_ANTES_DE_REENVIAR");
                }
            }
            if (deque.size() >= maxRequests) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "ESPERA_ANTES_DE_REENVIAR");
            }
            deque.addLast(now);
            return deque;
        });
    }

    @Scheduled(fixedRateString = "PT15M")
    public void sweep() {
        Instant windowStart = clock.instant().minus(windowMinutes, ChronoUnit.MINUTES);
        for (String key : history.keySet()) {
            history.computeIfPresent(key, (k, deque) -> {
                while (!deque.isEmpty() && deque.peekFirst().isBefore(windowStart)) {
                    deque.pollFirst();
                }
                return deque.isEmpty() ? null : deque;
            });
        }
    }

    private String key(Long donacionId, Long emisorId) {
        return donacionId + ":" + emisorId;
    }
}
