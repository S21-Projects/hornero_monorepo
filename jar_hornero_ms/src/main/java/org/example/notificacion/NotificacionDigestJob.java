package org.example.notificacion;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * N13/D6: one daily digest to every active admin (organizations pending validation + stale
 * donations). 08:00 Buenos Aires by default, {@code app.notificaciones.digest-cron} to change it.
 * There is no startup catch-up on purpose: a digest is a "good morning" nudge, and a late or
 * duplicated one after a restart is noise, not a missed obligation (unlike the stale-donations job,
 * which must act on data). The kill switch lives in {@link NotificacionService}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificacionDigestJob {

    private final NotificacionService servicio;

    @Scheduled(cron = "${app.notificaciones.digest-cron:0 0 8 * * *}", zone = "America/Argentina/Buenos_Aires")
    public void programado() {
        try {
            servicio.enviarDigest();
        } catch (RuntimeException e) {
            // A scheduler thread must never throw; enviarDigest already records its own failures.
            log.warn("[notificacion] digest failed: {}", e.getClass().getSimpleName());
        }
    }
}
