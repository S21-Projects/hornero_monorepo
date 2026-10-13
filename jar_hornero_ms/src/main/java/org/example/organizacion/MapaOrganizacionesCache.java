package org.example.organizacion;

import org.example.organizacion.dto.OrganizacionMapaResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.function.Supplier;

/**
 * In-memory TTL cache of the whole public map payload. The endpoint is anonymous, so without it every
 * request would hit the database. Staleness up to the TTL is accepted (it matches the response's
 * {@code Cache-Control: max-age}); there is no invalidation.
 */
@Component
public class MapaOrganizacionesCache {

    private record Snapshot(List<OrganizacionMapaResponse> datos, Instant expira) {}

    private final Clock clock;
    private final long ttlSeconds;
    private volatile Snapshot snapshot;

    public MapaOrganizacionesCache(Clock clock,
                                   @Value("${app.mapa.cache-ttl-seconds:300}") long ttlSeconds) {
        this.clock = clock;
        this.ttlSeconds = ttlSeconds;
    }

    /** Returns the cached list while fresh; otherwise reloads it with {@code loader} (one loader at a time). */
    public List<OrganizacionMapaResponse> obtener(Supplier<List<OrganizacionMapaResponse>> loader) {
        Snapshot actual = snapshot;
        if (vigente(actual)) {
            return actual.datos();
        }
        synchronized (this) {
            if (!vigente(snapshot)) {
                snapshot = new Snapshot(List.copyOf(loader.get()), clock.instant().plusSeconds(ttlSeconds));
            }
            return snapshot.datos();
        }
    }

    private boolean vigente(Snapshot s) {
        return s != null && clock.instant().isBefore(s.expira());
    }
}
