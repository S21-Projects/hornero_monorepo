package org.example.organizacion;

import org.example.organizacion.dto.OrganizacionMapaResponse;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class MapaOrganizacionesCacheTest {

    /** Clock whose instant can be moved by the test. */
    private static final class MovableClock extends Clock {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");

        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    @Test
    void servesTheSnapshotWithinTheTtlAndReloadsAfterIt() {
        MovableClock clock = new MovableClock();
        MapaOrganizacionesCache cache = new MapaOrganizacionesCache(clock, 300);
        AtomicInteger loads = new AtomicInteger();
        java.util.function.Supplier<List<OrganizacionMapaResponse>> loader = () -> {
            loads.incrementAndGet();
            return List.of();
        };

        cache.obtener(loader);
        clock.now = clock.now.plusSeconds(299);
        cache.obtener(loader);
        assertThat(loads).hasValue(1);

        clock.now = clock.now.plusSeconds(2);
        cache.obtener(loader);
        assertThat(loads).hasValue(2);
    }
}
