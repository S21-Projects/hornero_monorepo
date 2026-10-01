package org.example.asignacion.worker;

import org.example.asignacion.worker.dto.EntradaRondaV1;
import org.example.asignacion.worker.dto.SalidaRondaV1;

/**
 * Transport-independent seam to the {@code go_algorithms_worker} solver (AD-1, AD-9). The real HTTP
 * implementation ({@code HttpAsignadorClient}) is wired in slice 5c-ii; {@code RondaService} depends
 * on this interface only, so its tests use a fake collaborator.
 */
public interface AsignadorClient {

    /**
     * @throws AsignadorNoDisponibleException the worker is unreachable or times out (503 WORKER_NO_DISPONIBLE)
     * @throws AsignadorRespuestaInvalidaException the worker answered with an invalid/unexpected payload (502 RESPUESTA_WORKER_INVALIDA)
     */
    SalidaRondaV1 ejecutar(EntradaRondaV1 entrada);
}
