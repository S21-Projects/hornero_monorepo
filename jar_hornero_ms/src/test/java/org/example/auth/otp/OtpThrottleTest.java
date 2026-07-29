package org.example.auth.otp;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OtpThrottleTest {

    private MutableClock clock;
    private OtpThrottle throttle;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        // 3 requests / 15 min window, 60s cooldown — matches app.otp.resend-* defaults.
        throttle = new OtpThrottle(clock, 3, 15, 60);
    }

    @Test
    void firstRequest_isAllowed() {
        assertThatCode(() -> throttle.checkAndRecord("user@test.com")).doesNotThrowAnyException();
    }

    @Test
    void requestWithinCooldown_isRejected() {
        throttle.checkAndRecord("user@test.com");
        clock.advance(Duration.ofSeconds(30));

        assertThatThrownBy(() -> throttle.checkAndRecord("user@test.com"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("429")
                .hasMessageContaining("ESPERA_ANTES_DE_REENVIAR");
    }

    @Test
    void requestAfterCooldownElapses_isAllowed() {
        throttle.checkAndRecord("user@test.com");
        clock.advance(Duration.ofSeconds(61));

        assertThatCode(() -> throttle.checkAndRecord("user@test.com")).doesNotThrowAnyException();
    }

    @Test
    void fourthRequestWithinWindow_isRejectedEvenPastCooldown() {
        throttle.checkAndRecord("user@test.com");
        clock.advance(Duration.ofSeconds(61));
        throttle.checkAndRecord("user@test.com");
        clock.advance(Duration.ofSeconds(61));
        throttle.checkAndRecord("user@test.com");
        clock.advance(Duration.ofSeconds(61));

        assertThatThrownBy(() -> throttle.checkAndRecord("user@test.com"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("429");
    }

    @Test
    void requestOutsideWindow_resetsTheCounter() {
        throttle.checkAndRecord("user@test.com");
        clock.advance(Duration.ofSeconds(61));
        throttle.checkAndRecord("user@test.com");
        clock.advance(Duration.ofSeconds(61));
        throttle.checkAndRecord("user@test.com");
        clock.advance(Duration.ofMinutes(16));

        assertThatCode(() -> throttle.checkAndRecord("user@test.com")).doesNotThrowAnyException();
    }

    @Test
    void differentEmails_areThrottledIndependently() {
        throttle.checkAndRecord("a@test.com");

        assertThatCode(() -> throttle.checkAndRecord("b@test.com")).doesNotThrowAnyException();
    }

    /** Deterministic {@link Clock} test double whose instant advances manually. */
    private static final class MutableClock extends Clock {
        private Instant instant;

        MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advance(Duration duration) {
            instant = instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
