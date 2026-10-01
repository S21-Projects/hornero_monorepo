package org.example.asignacion.worker;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/**
 * Wires the real {@link AsignadorClient} bean (AD-1, slice 5c-ii): {@link HttpAsignadorClient} when
 * {@code app.worker.url} is configured, otherwise {@link AsignadorNoConfiguradoClient} so the MS
 * still boots and serves everything else when the worker is unconfigured or down — only
 * {@code RondaService.ejecutar} degrades, answering {@code 503 WORKER_NO_DISPONIBLE}.
 */
@Configuration
public class AsignadorConfig {

    @Bean
    public AsignadorClient asignadorClient(RestClient.Builder restClientBuilder,
                                            @Value("${app.worker.url:}") String workerUrl) {
        if (workerUrl == null || workerUrl.isBlank()) {
            return new AsignadorNoConfiguradoClient();
        }
        return new HttpAsignadorClient(restClientBuilder, workerUrl);
    }
}
