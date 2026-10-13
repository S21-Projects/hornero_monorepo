package org.example.reporte;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReporteThrottleTest {

    private final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-10-13T12:00:00Z"));
    private final Clock clock = new Clock() {
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now.get(); }
    };
    private final ReporteThrottle throttle = new ReporteThrottle(clock, 3, 24);

    @Test
    void allowsTheCapThenAnswers429PerUser() {
        for (int i = 0; i < 3; i++) throttle.checkAndRecord(1L);

        assertThatThrownBy(() -> throttle.checkAndRecord(1L)).isInstanceOfSatisfying(ResponseStatusException.class, e -> {
            assertThat(e.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
            assertThat(e.getReason()).isEqualTo("DEMASIADOS_REPORTES");
        });
        throttle.checkAndRecord(2L); // another user is independent
    }

    @Test
    void theWindowSlides_afterADayTheUserMaySubmitAgain() {
        for (int i = 0; i < 3; i++) throttle.checkAndRecord(1L);

        now.set(now.get().plusSeconds(23 * 3600));
        assertThatThrownBy(() -> throttle.checkAndRecord(1L)).isInstanceOf(ResponseStatusException.class);
        now.set(now.get().plusSeconds(2 * 3600));
        throttle.checkAndRecord(1L);
    }

    @Test
    void sweepForgetsExpiredHistory() {
        for (int i = 0; i < 3; i++) throttle.checkAndRecord(1L);
        now.set(now.get().plusSeconds(25 * 3600));

        throttle.sweep();
        for (int i = 0; i < 3; i++) throttle.checkAndRecord(1L);
    }
}
