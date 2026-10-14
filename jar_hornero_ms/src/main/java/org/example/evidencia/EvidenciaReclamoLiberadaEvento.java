package org.example.evidencia;

import java.util.List;

/**
 * Published inside the anonymization transaction: the claim evidence of {@code usuarioId} is no
 * longer referenced by any row and its objects can be deleted once the transaction commits.
 * {@code keys} were captured before the claim rows were cleared.
 */
public record EvidenciaReclamoLiberadaEvento(Long usuarioId, List<String> keys) {

    public EvidenciaReclamoLiberadaEvento {
        keys = List.copyOf(keys);
    }
}
