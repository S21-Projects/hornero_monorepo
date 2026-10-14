package org.example.evidencia;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

/**
 * Port to the object store, scoped to claim evidence: every key it lists or deletes lives under
 * {@code reclamo-evidencia/}. The port cannot express another prefix, so a caller can never reach
 * {@code org-evidencia/}, {@code org-banner/} or {@code org-profile/} through it.
 */
public interface EvidenciaAlmacen {

    /** false for the no-op fallback (object storage not configured). */
    boolean disponible();

    /** Every object under {@code reclamo-evidencia/}, across all pages. */
    List<ObjetoAlmacenado> listar();

    /** Deletes in batches of at most 1000; keys outside {@code reclamo-evidencia/} are rejected. */
    ResultadoBorrado borrar(Collection<String> keys);

    record ObjetoAlmacenado(String key, Instant ultimaModificacion) {
    }

    record ResultadoBorrado(int borrados, int fallidos) {
        public static final ResultadoBorrado VACIO = new ResultadoBorrado(0, 0);
    }
}
