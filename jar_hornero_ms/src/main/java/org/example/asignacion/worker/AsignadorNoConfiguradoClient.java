package org.example.asignacion.worker;

import org.example.asignacion.worker.dto.EntradaRondaV1;
import org.example.asignacion.worker.dto.SalidaRondaV1;
import org.springframework.stereotype.Component;

/**
 * Placeholder {@link AsignadorClient} bean so the application context can start before slice 5c-ii
 * wires the real {@code HttpAsignadorClient}/{@code AsignadorConfig} (which will replace this bean,
 * conditionally on {@code app.worker.url} per the design's "blank ⇒ AsignadorNoConfigurado client
 * that throws 503" note). Every call fails as "worker unavailable" — {@code RondaService.ejecutar}
 * already persists a {@code FALLIDA} ronda and answers 503 for this outcome (AD-9 step 5).
 */
@Component
public class AsignadorNoConfiguradoClient implements AsignadorClient {

    @Override
    public SalidaRondaV1 ejecutar(EntradaRondaV1 entrada) {
        throw new AsignadorNoDisponibleException("app.worker.url no configurado (pendiente de slice 5c-ii)");
    }
}
