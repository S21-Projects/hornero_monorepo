package org.example.asignacion.worker;

/** The worker answered but the payload could not be trusted (AD-9 step 5: 502 RESPUESTA_WORKER_INVALIDA). */
public class AsignadorRespuestaInvalidaException extends RuntimeException {

    public AsignadorRespuestaInvalidaException(String message) {
        super(message);
    }

    public AsignadorRespuestaInvalidaException(String message, Throwable cause) {
        super(message, cause);
    }
}
