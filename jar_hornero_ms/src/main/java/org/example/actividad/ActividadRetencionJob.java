package org.example.actividad;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;

/**
 * Daily retention purge (N10/D12). This is the only code path that deletes activity rows, an
 * explicit exception to the append-only rule, and it deletes by age only. On PostgreSQL a trigger (V004)
 * rejects the delete unless {@link ActividadPurgaHabilitacion} opened the window in this transaction. The default of 365 days
 * is provisional until D12 (PII retention) is decided. The purge itself is recorded.
 */
@Slf4j
@Component
public class ActividadRetencionJob {

    private final ActividadRetencionRepository repository;
    private final ActividadService actividadService;
    private final ActividadPurgaHabilitacion habilitacion;
    private final Clock clock;
    private final long retencionDias;

    public ActividadRetencionJob(ActividadRetencionRepository repository, ActividadService actividadService,
                                 Clock clock, ActividadPurgaHabilitacion habilitacion,
                                 @Value("${app.actividad.retencion-dias:365}") long retencionDias) {
        this.repository = repository;
        this.actividadService = actividadService;
        this.clock = clock;
        this.habilitacion = habilitacion;
        this.retencionDias = retencionDias;
    }

    @Scheduled(cron = "${app.actividad.retencion-cron:0 15 3 * * *}")
    @Transactional
    public int purgar() {
        habilitacion.habilitar();
        int borradas = repository.purgarAnterioresA(clock.instant().minus(Duration.ofDays(retencionDias)));
        if (borradas > 0) {
            log.info("[actividad] purged {} rows older than {} days", borradas, retencionDias);
            actividadService.registrar(ActividadService.Registro.de(TipoActividad.ACTIVIDAD_PURGADA)
                    .sistema()
                    .detalle(borradas + " registros anteriores a " + retencionDias + " días"));
        }
        return borradas;
    }
}
