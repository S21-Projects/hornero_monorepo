package org.example.organizacion.radio;

import java.util.Optional;

/** Used when {@code app.worker.url} is not configured: no radio is ever resolved. */
public class RadioCensalNoConfiguradoClient implements RadioCensalClient {

    @Override
    public Optional<String> resolver(double latitud, double longitud) {
        return Optional.empty();
    }
}
