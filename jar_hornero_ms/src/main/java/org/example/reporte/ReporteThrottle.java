package org.example.reporte;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory per-user cap on report submissions inside a sliding window (default 20 per 24 h),
 * following {@code OtpThrottle} / {@code CodigoEntregaThrottle}. Complements the cap on
 * simultaneously pending reports, which the service reads from the database.
 */
@Component
public class ReporteThrottle {

    public static final String DEMASIADOS_REPORTES = "DEMASIADOS_REPORTES";

    private final Clock clock;
    private final int maxRequests;
    private final long windowHours;
    private final ConcurrentHashMap<Long, Deque<Instant>> history = new ConcurrentHashMap<>();

    public ReporteThrottle(
            Clock clock,
            @Value("${app.reporte.diario-max:20}") int maxRequests,
            @Value("${app.reporte.window-hours:24}") long windowHours) {
        this.clock = clock;
        this.maxRequests = maxRequests;
        this.windowHours = windowHours;
    }

    /** Throws 429 DEMASIADOS_REPORTES when the window cap is reached; otherwise records this request. */
    public void checkAndRecord(Long userId) {
        Instant now = clock.instant();
        Instant windowStart = now.minus(windowHours, ChronoUnit.HOURS);
        history.compute(userId, (k, existing) -> {
            Deque<Instant> deque = existing != null ? existing : new ArrayDeque<>();
            while (!deque.isEmpty() && deque.peekFirst().isBefore(windowStart)) {
                deque.pollFirst();
            }
            if (deque.size() >= maxRequests) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, DEMASIADOS_REPORTES);
            }
            deque.addLast(now);
            return deque;
        });
    }

    @Scheduled(fixedRateString = "PT1H")
    public void sweep() {
        Instant windowStart = clock.instant().minus(windowHours, ChronoUnit.HOURS);
        for (Long key : history.keySet()) {
            history.computeIfPresent(key, (k, deque) -> {
                while (!deque.isEmpty() && deque.peekFirst().isBefore(windowStart)) {
                    deque.pollFirst();
                }
                return deque.isEmpty() ? null : deque;
            });
        }
    }
}
