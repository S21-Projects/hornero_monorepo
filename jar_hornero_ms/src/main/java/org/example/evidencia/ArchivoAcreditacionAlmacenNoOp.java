package org.example.evidencia;

/** Used unless retention is explicitly enabled and the bucket is configured: deletes nothing. */
public class ArchivoAcreditacionAlmacenNoOp implements ArchivoAcreditacionAlmacen {

    @Override
    public boolean disponible() {
        return false;
    }

    @Override
    public boolean borrar(String key) {
        return false;
    }
}
