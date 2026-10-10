package org.example.necesidad;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.domain.EstadoNecesidad;
import org.example.domain.NecesidadRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.EnumSet;

/**
 * D2/N3: {@code fechaVencimiento} is a necesidad's TTL. Once it is in the past, an open
 * ({@code ABIERTA}/{@code EN_PROGRESO}) necesidad becomes {@code VENCIDA}. Runs daily just after
 * midnight (Argentina) and once at startup, so a host that was off at midnight (the Raspberry Pi)
 * catches up. Donation creation does not depend on this job's timing (it checks the date itself),
 * and donations already in flight are deliberately left untouched.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VencimientoNecesidadesJob {

    private final NecesidadRepository necesidadRepository;
    private final Clock clock;

    @Scheduled(cron = "${app.necesidades.vencimiento-cron:0 5 0 * * *}", zone = "America/Argentina/Buenos_Aires")
    @Transactional
    public int vencerNecesidades() {
        int vencidas = necesidadRepository.cambiarEstadoDeVencidas(
                EnumSet.of(EstadoNecesidad.ABIERTA, EstadoNecesidad.EN_PROGRESO),
                LocalDate.now(clock),
                EstadoNecesidad.VENCIDA);
        if (vencidas > 0) {
            log.info("[necesidades] {} expired necesidades marked VENCIDA", vencidas);
        }
        return vencidas;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void alIniciar() {
        vencerNecesidades();
    }
}
