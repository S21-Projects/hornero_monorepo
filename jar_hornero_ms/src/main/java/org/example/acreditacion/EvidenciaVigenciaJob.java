package org.example.acreditacion;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * RN-04: daily (and once at startup, RNF17: the Raspberry Pi may be off at the scheduled hour)
 * move expired APROBADA evidence to VENCIDA and send the one "expires soon" reminder. Same shape as
 * DonacionesEstancadasJob: each row has its own transaction through {@link VigenciaEvidenciaService},
 * a failing row is skipped and logged, the run never throws. Idempotent. Not @Transactional.
 */
@Slf4j
@Component
public class EvidenciaVigenciaJob {

    private final VigenciaEvidenciaService servicio;

    public EvidenciaVigenciaJob(VigenciaEvidenciaService servicio) {
        this.servicio = servicio;
    }

    public record Resumen(int vencidas, int recordatorios, int fallidas) {
    }

    @Scheduled(cron = "${app.evidencia.vigencia.cron:0 20 0 * * *}", zone = "America/Argentina/Buenos_Aires")
    public void programado() {
        ejecutar();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void alIniciar() {
        ejecutar();
    }

    public Resumen ejecutar() {
        int vencidas = 0;
        int recordatorios = 0;
        int fallidas = 0;
        try {
            for (Long id : servicio.idsParaVencer()) {
                try {
                    if (servicio.vencer(id)) {
                        vencidas++;
                    }
                } catch (RuntimeException e) {
                    fallidas++;
                    log.warn("[evidencia] evidence {} could not be expired: {}", id, e.getClass().getSimpleName());
                }
            }
            for (Long id : servicio.idsParaRecordar()) {
                try {
                    if (servicio.recordar(id)) {
                        recordatorios++;
                    }
                } catch (RuntimeException e) {
                    fallidas++;
                    log.warn("[evidencia] reminder for evidence {} failed: {}", id, e.getClass().getSimpleName());
                }
            }
        } catch (RuntimeException e) {
            log.warn("[evidencia] expiry run failed: {}", e.getClass().getSimpleName());
        }
        if (vencidas + recordatorios + fallidas > 0) {
            log.info("[evidencia] expiry run: {} expired, {} reminders, {} failed", vencidas, recordatorios, fallidas);
        }
        return new Resumen(vencidas, recordatorios, fallidas);
    }
}
