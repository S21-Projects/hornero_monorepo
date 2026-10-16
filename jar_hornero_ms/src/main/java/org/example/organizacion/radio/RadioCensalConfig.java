package org.example.organizacion.radio;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/**
 * Wires the {@link RadioCensalClient}: HTTP when {@code app.worker.url} is configured (the same worker
 * the ronda uses), otherwise a client that never resolves, so the MS boots and saves organizaciones
 * without a worker.
 */
@Configuration
public class RadioCensalConfig {

    @Bean
    public RadioCensalClient radioCensalClient(RestClient.Builder restClientBuilder,
                                               @Value("${app.worker.url:}") String workerUrl) {
        if (workerUrl == null || workerUrl.isBlank()) {
            return new RadioCensalNoConfiguradoClient();
        }
        return new HttpRadioCensalClient(restClientBuilder, workerUrl);
    }
}
