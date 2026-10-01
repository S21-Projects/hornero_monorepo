package org.example.asignacion.worker;

import org.example.asignacion.worker.dto.EntradaRondaV1;
import org.example.asignacion.worker.dto.SalidaRondaV1;

/**
 * {@link AsignadorClient} used when {@code app.worker.url} is blank (AD-1, wired by
 * {@link AsignadorConfig}): the MS still boots and serves everything else when the worker is
 * unconfigured — every call fails as "worker unavailable", and {@code RondaService.ejecutar}
 * already persists a {@code FALLIDA} ronda and answers 503 for this outcome (AD-9 step 5).
 */
public class AsignadorNoConfiguradoClient implements AsignadorClient {

    @Override
    public SalidaRondaV1 ejecutar(EntradaRondaV1 entrada) {
        throw new AsignadorNoDisponibleException("app.worker.url no configurado (pendiente de slice 5c-ii)");
    }
}
