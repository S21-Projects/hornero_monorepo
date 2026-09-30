package org.example.donacion.entrega;

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

/**
 * Mirrors {@code OtpThrottleTest} exactly (AD-6): same sliding-window + cooldown algorithm, keyed
 * by {@code donacionId:emisorId} instead of email.
 */
class CodigoEntregaThrottleTest {

    private MutableClock clock;
    private CodigoEntregaThrottle throttle;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        // 5 requests / 15 min window, 30s cooldown — matches app.entrega.generar-* defaults.
        throttle = new CodigoEntregaThrottle(clock, 5, 15, 30);
    }

    @Test
    void firstRequest_isAllowed() {
        assertThatCode(() -> throttle.checkAndRecord(1L, 2L)).doesNotThrowAnyException();
    }

    @Test
    void requestWithinCooldown_isRejected() {
        throttle.checkAndRecord(1L, 2L);
        clock.advance(Duration.ofSeconds(10));

        assertThatThrownBy(() -> throttle.checkAndRecord(1L, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("429")
                .hasMessageContaining("ESPERA_ANTES_DE_REENVIAR");
    }

    @Test
    void requestAfterCooldownElapses_isAllowed() {
        throttle.checkAndRecord(1L, 2L);
        clock.advance(Duration.ofSeconds(31));

        assertThatCode(() -> throttle.checkAndRecord(1L, 2L)).doesNotThrowAnyException();
    }

    @Test
    void sixthRequestWithinWindow_isRejectedEvenPastCooldown() {
        for (int i = 0; i < 5; i++) {
            throttle.checkAndRecord(1L, 2L);
            clock.advance(Duration.ofSeconds(31));
        }

        assertThatThrownBy(() -> throttle.checkAndRecord(1L, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("429");
    }

    @Test
    void differentPartiesOnSameDonacion_areThrottledIndependently() {
        throttle.checkAndRecord(1L, 2L); // donante

        assertThatCode(() -> throttle.checkAndRecord(1L, 3L)).doesNotThrowAnyException(); // referente
    }

    @Test
    void sameEmisorOnDifferentDonaciones_areThrottledIndependently() {
        throttle.checkAndRecord(1L, 2L);

        assertThatCode(() -> throttle.checkAndRecord(2L, 2L)).doesNotThrowAnyException();
    }

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
