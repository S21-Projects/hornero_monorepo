package org.example.asignacion;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.domain.Ronda;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * N7/D7: optional scheduled ronda. Rondas stay manual by default; setting
 * {@code app.rondas.auto.enabled=true} (env {@code RONDAS_AUTO_ENABLED}) registers this bean and
 * therefore the cron task. The flag is bean-gated rather than checked at run time because it
 * cannot change while the process runs, and a disabled job then leaves no scheduled task at all.
 *
 * <p>It runs the same logic as {@code POST /api/rondas} with no user (origin AUTOMATICA). A busy
 * ronda (409), a down worker (503/502) or any other failure is logged and skipped: a scheduler
 * thread must never throw, and the next tick simply tries again.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.rondas.auto.enabled", havingValue = "true")
public class RondaAutomaticaJob {

    private final RondaService rondaService;

    @Scheduled(cron = "${app.rondas.auto.cron:0 0 6 * * *}", zone = "America/Argentina/Buenos_Aires")
    public void ejecutar() {
        try {
            Ronda ronda = rondaService.ejecutarAutomatica();
            log.info("[rondas] automatic ronda {} finished: {} asignadas", ronda.getId(), ronda.getAsignadas());
        } catch (ResponseStatusException e) {
            log.warn("[rondas] automatic ronda skipped: {}", e.getReason());
        } catch (Exception e) {
            log.error("[rondas] automatic ronda failed (is scripts/sql/V002 applied?): {}", e.getMessage());
        }
    }
}
