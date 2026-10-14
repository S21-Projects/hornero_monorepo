package org.example.evidencia;

import org.example.reclamo.ClaveEvidenciaReclamo;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** In-memory {@link EvidenciaAlmacen} with the same prefix guard as the real adapter. */
public class EvidenciaAlmacenEnMemoria implements EvidenciaAlmacen {

    /** Every object in the bucket, any prefix, so tests can prove other prefixes are untouched. */
    public final Map<String, Instant> objetos = new LinkedHashMap<>();
    public boolean fallarAlBorrar;
    public int listados;

    public EvidenciaAlmacenEnMemoria con(String key, Instant ultimaModificacion) {
        objetos.put(key, ultimaModificacion);
        return this;
    }

    public Set<String> claves() {
        return objetos.keySet();
    }

    @Override
    public boolean disponible() {
        return true;
    }

    @Override
    public List<ObjetoAlmacenado> listar() {
        listados++;
        List<ObjetoAlmacenado> res = new ArrayList<>();
        objetos.forEach((k, t) -> {
            if (k.startsWith(ClaveEvidenciaReclamo.PREFIJO)) {
                res.add(new ObjetoAlmacenado(k, t));
            }
        });
        return res;
    }

    @Override
    public ResultadoBorrado borrar(Collection<String> keys) {
        if (fallarAlBorrar) {
            throw new IllegalStateException("store down");
        }
        int borrados = 0;
        for (String key : keys) {
            if (!key.startsWith(ClaveEvidenciaReclamo.PREFIJO)) {
                throw new IllegalArgumentException("outside the claim evidence prefix");
            }
            if (objetos.remove(key) != null) {
                borrados++;
            }
        }
        return new ResultadoBorrado(borrados, 0);
    }
}
