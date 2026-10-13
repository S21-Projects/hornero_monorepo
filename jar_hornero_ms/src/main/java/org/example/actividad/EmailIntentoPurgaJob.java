package org.example.actividad;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;

/**
 * N15/D12 (policy 1.5): the email typed in a failed login is sensitive and its usefulness for
 * spotting credential stuffing fades, so after {@code app.actividad.email-intento-dias} (default 90)
 * days it is set to NULL. The row (who, when, what, IP) stays until the 365-day retention.
 *
 * <p>The activity table is immutable: on PostgreSQL the trigger from V006 allows exactly this
 * UPDATE (only {@code email_intento}, only to NULL) and only inside a transaction that opened the
 * purge window ({@link ActividadPurgaHabilitacion}). Without V006 the statement fails; the job
 * catches that, logs it and tries again next run, and never affects the retention purge, which is
 * a different transaction. Runs daily and once at startup (the Pi may be off at night).
 */
@Slf4j
@Component
public class EmailIntentoPurgaJob {

    private final ActividadRetencionRepository repository;
    private final ActividadService actividadService;
    private final ActividadPurgaHabilitacion habilitacion;
    private final Clock clock;
    private final TransactionTemplate transaccion;
    private final long dias;

    public EmailIntentoPurgaJob(ActividadRetencionRepository repository, ActividadService actividadService,
                                ActividadPurgaHabilitacion habilitacion, Clock clock,
                                PlatformTransactionManager transactionManager,
                                @Value("${app.actividad.email-intento-dias:90}") long dias) {
        this.repository = repository;
        this.actividadService = actividadService;
        this.habilitacion = habilitacion;
        this.clock = clock;
        this.transaccion = new TransactionTemplate(transactionManager);
        this.dias = dias;
    }

    @Scheduled(cron = "${app.actividad.email-intento-cron:0 20 3 * * *}")
    public void programado() {
        ejecutar();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void alIniciar() {
        ejecutar();
    }

    /** Returns how many rows lost their email; 0 when nothing was due or the purge could not run. */
    public int ejecutar() {
        try {
            Integer n = transaccion.execute(status -> {
                habilitacion.habilitar();
                int anuladas = repository.anularEmailIntentoAnterioresA(clock.instant().minus(Duration.ofDays(dias)));
                if (anuladas > 0) {
                    log.info("[actividad] cleared the attempted email of {} rows older than {} days", anuladas, dias);
                    actividadService.registrar(ActividadService.Registro.de(TipoActividad.EMAIL_INTENTO_PURGADO)
                            .sistema().detalle(anuladas + " correos de intentos anteriores a " + dias + " días"));
                }
                return anuladas;
            });
            return n == null ? 0 : n;
        } catch (RuntimeException e) {
            log.error("[actividad] could not clear attempted emails (is scripts/sql/V006 applied?): {}",
                    TextoSeguro.limpiar(e.getMessage(), 200));
            return 0;
        }
    }
}
