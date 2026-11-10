package org.example.auditoria;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Startup backfill of the hash chain (C4, RNF07): seals the events that predate the
 * {@code prev_hash}/{@code hash} columns, in insertion order. It runs on {@code ApplicationReadyEvent},
 * after every {@code ApplicationRunner} (the accreditation backfill and the seeds create events
 * too, and those are sealed on insert). It is a Java task and not a SQL script because the
 * canonical encoding lives in {@link CadenaHash}; a second implementation in SQL could drift.
 * Failures are logged, never fatal: an event saved meanwhile seals its organization's older rows
 * first, so the chain stays consistent either way.
 */
@Slf4j
@Component
public class CadenaArranque {

    private final CadenaEventos cadena;

    public CadenaArranque(CadenaEventos cadena) {
        this.cadena = cadena;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Order(10)
    public void alIniciar() {
        try {
            int sellados = cadena.completarPendientes();
            log.info("[auditoria] hash chain backfill complete (idempotent): {} event(s) sealed", sellados);
        } catch (RuntimeException e) {
            log.error("[auditoria] hash chain backfill failed, it will be retried on the next start: {}", e.toString());
        }
    }
}
