package org.example.organizacion.radio;

import lombok.extern.slf4j.Slf4j;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionOperations;

import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Self-healing backfill of {@code codigo_radio} (spec organizacion-radio-censal). Every hour it takes
 * up to {@code max-por-corrida} organizaciones that have coordinates but no radio and asks the worker
 * for it, so both the initial backfill after deploy and any create/edit whose lookup failed (worker
 * down) are filled within the next hour. An existing radio is never overwritten.
 *
 * <p>The lookup runs outside any transaction (no pooled connection is held during the HTTP call);
 * each fill is its own short transaction that re-reads the row and skips it when it changed meanwhile
 * (radio set, coordinates moved, optimistic-lock conflict). Organizaciones outside every radio are
 * retried each run: bounded by the batch cap and one cheap lookup each. A scheduler thread must never
 * throw, so unexpected failures are logged and the next tick tries again.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.radios.backfill.enabled", havingValue = "true", matchIfMissing = true)
public class RadioCensalBackfillJob {

    private final OrganizacionRepository organizacionRepository;
    private final RadioCensalClient radioCensalClient;
    private final TransactionOperations transactionOperations;
    private final int maxPorCorrida;

    public RadioCensalBackfillJob(OrganizacionRepository organizacionRepository,
                                  RadioCensalClient radioCensalClient,
                                  TransactionOperations transactionOperations,
                                  @Value("${app.radios.backfill.max-por-corrida:500}") int maxPorCorrida) {
        this.organizacionRepository = organizacionRepository;
        this.radioCensalClient = radioCensalClient;
        this.transactionOperations = transactionOperations;
        this.maxPorCorrida = maxPorCorrida;
    }

    @Scheduled(cron = "${app.radios.backfill.cron:0 15 * * * *}", zone = "America/Argentina/Buenos_Aires")
    public void programada() {
        try {
            int rellenadas = ejecutar();
            if (rellenadas > 0) {
                log.info("[radios] backfill filled codigo_radio of {} organizaciones", rellenadas);
            }
        } catch (RuntimeException e) {
            log.error("[radios] backfill failed: {}", e.getMessage());
        }
    }

    /** One run; returns how many organizaciones got a radio. */
    int ejecutar() {
        int rellenadas = 0;
        for (Organizacion pendiente : organizacionRepository.findPendientesDeRadio(PageRequest.of(0, maxPorCorrida))) {
            Double lat = pendiente.getLatitud();
            Double lng = pendiente.getLongitud();
            Optional<String> radio = radioCensalClient.resolver(lat, lng);
            if (radio.isEmpty()) {
                continue;
            }
            try {
                AtomicBoolean guardada = new AtomicBoolean(false);
                transactionOperations.executeWithoutResult(status ->
                        guardada.set(rellenar(pendiente.getId(), lat, lng, radio.get())));
                if (guardada.get()) {
                    rellenadas++;
                }
            } catch (OptimisticLockingFailureException e) {
                log.debug("[radios] backfill skipped organizacion {}: concurrent update", pendiente.getId());
            }
        }
        return rellenadas;
    }

    private boolean rellenar(Long id, Double lat, Double lng, String radio) {
        Optional<Organizacion> actual = organizacionRepository.findById(id);
        if (actual.isEmpty()) {
            return false;
        }
        Organizacion organizacion = actual.get();
        if (organizacion.getCodigoRadio() != null
                || !Objects.equals(organizacion.getLatitud(), lat)
                || !Objects.equals(organizacion.getLongitud(), lng)) {
            return false;
        }
        organizacion.setCodigoRadio(radio);
        organizacionRepository.save(organizacion);
        return true;
    }
}
