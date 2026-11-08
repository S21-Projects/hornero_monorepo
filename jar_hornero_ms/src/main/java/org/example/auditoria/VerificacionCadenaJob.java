package org.example.auditoria;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Daily verification of the audit hash chain, plus one run at startup (the Raspberry Pi may be off
 * at the scheduled hour). The startup run happens after {@link CadenaArranque} has sealed legacy
 * rows. Failures are logged and never escape: a broken verifier must not take the application down.
 */
@Slf4j
@Component
public class VerificacionCadenaJob {

    private final AuditoriaCadenaServicio servicio;

    public VerificacionCadenaJob(AuditoriaCadenaServicio servicio) {
        this.servicio = servicio;
    }

    @Scheduled(cron = "${app.auditoria.cadena.cron:0 40 3 * * *}")
    public void programado() {
        ejecutar();
    }

    @EventListener(ApplicationReadyEvent.class)
    @Order(20)
    public void alIniciar() {
        ejecutar();
    }

    private void ejecutar() {
        try {
            servicio.ejecutarDiaria();
        } catch (RuntimeException e) {
            log.error("[auditoria] the hash chain verification could not run: {}", e.toString());
        }
    }
}
