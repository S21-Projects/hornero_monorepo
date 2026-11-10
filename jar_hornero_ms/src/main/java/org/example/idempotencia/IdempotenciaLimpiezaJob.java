package org.example.idempotencia;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Daily purge of expired idempotency keys (policy: keys live {@code app.idempotencia.ttl-horas}, default 24 h). */
@Slf4j
@Component
@RequiredArgsConstructor
public class IdempotenciaLimpiezaJob {

    private final IdempotenciaService service;

    @Scheduled(cron = "${app.idempotencia.limpieza-cron:0 30 3 * * *}")
    public void purgar() {
        int borradas = service.purgarExpiradas();
        if (borradas > 0) {
            log.info("[idempotencia] purged {} expired keys", borradas);
        }
    }
}
