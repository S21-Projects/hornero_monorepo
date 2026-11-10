package org.example.idempotencia;

public enum EstadoIdempotencia {
    /** The first request with this key is still running (or crashed before finishing). */
    EN_PROCESO,
    /** The original request finished; its status and body are stored for replay. */
    COMPLETADA
}
