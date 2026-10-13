package org.example.evidencia;

import java.util.Collection;
import java.util.List;

/** Used when object storage is not configured: nothing is listed and nothing is deleted. */
public class EvidenciaAlmacenNoOp implements EvidenciaAlmacen {

    @Override
    public boolean disponible() {
        return false;
    }

    @Override
    public List<ObjetoAlmacenado> listar() {
        return List.of();
    }

    @Override
    public ResultadoBorrado borrar(Collection<String> keys) {
        return ResultadoBorrado.VACIO;
    }
}
