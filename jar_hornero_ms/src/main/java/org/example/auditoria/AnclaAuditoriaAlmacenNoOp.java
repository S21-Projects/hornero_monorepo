package org.example.auditoria;

import java.time.LocalDate;

/** The default: no bucket is contacted and no S3 client exists. */
public class AnclaAuditoriaAlmacenNoOp implements AnclaAuditoriaAlmacen {

    @Override
    public boolean disponible() {
        return false;
    }

    @Override
    public boolean publicar(LocalDate fecha, String contenido) {
        return false;
    }
}
