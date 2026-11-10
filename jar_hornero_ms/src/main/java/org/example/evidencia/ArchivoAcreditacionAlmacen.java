package org.example.evidencia;

/**
 * Port to the object store for accreditation evidence files, and nothing else: it can only delete
 * keys of the form {@code org-evidencia/{orgId}/{file}}. It is separate from {@link EvidenciaAlmacen}
 * (claim evidence) on purpose, so enabling one kind of deletion can never enable the other.
 */
public interface ArchivoAcreditacionAlmacen {

    /** false for the no-op fallback: nothing is ever deleted. */
    boolean disponible();

    /**
     * Deletes one object. Returns true when the store accepted the deletion (deleting an absent
     * object also counts). Throws {@link IllegalArgumentException} for any key that is not an
     * accreditation evidence key, before any request is made.
     */
    boolean borrar(String key);
}
