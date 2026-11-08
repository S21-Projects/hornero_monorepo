package org.example.auditoria;

import java.time.LocalDate;

/**
 * Where the daily anchor of the audit chain is published. Deliberately has no delete operation: an
 * anchor is only useful if nobody, including this application, can take it back.
 */
public interface AnclaAuditoriaAlmacen {

    /** True when anchors really go to a bucket; false for the no-op store. */
    boolean disponible();

    /**
     * Writes the anchor of {@code fecha} unless one already exists for that day.
     *
     * @return true if it was written, false if it was skipped (no-op store, or already published)
     */
    boolean publicar(LocalDate fecha, String contenido);
}
