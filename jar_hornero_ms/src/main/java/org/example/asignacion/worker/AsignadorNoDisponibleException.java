package org.example.asignacion.worker;

/** The worker was unreachable, timed out, or refused the call (AD-9 step 5: 503 WORKER_NO_DISPONIBLE). */
public class AsignadorNoDisponibleException extends RuntimeException {

    public AsignadorNoDisponibleException(String message) {
        super(message);
    }

    public AsignadorNoDisponibleException(String message, Throwable cause) {
        super(message, cause);
    }
}
