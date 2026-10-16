package org.example.organizacion.radio;

import java.util.Optional;

/**
 * Resolves a coordinate to its 2022 census radio through the worker. Best-effort by contract: an
 * implementation never throws, it answers empty when the radio cannot be resolved for any reason, so
 * saving an organización never depends on the worker.
 */
public interface RadioCensalClient {

    Optional<String> resolver(double latitud, double longitud);
}
