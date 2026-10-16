package org.example.organizacion.radio;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;

/**
 * Calls the worker's {@code POST /v1/radio}. Timeouts are short (connect 1s, read 2s) because the
 * lookup runs inside an organización write; every failure (unreachable, timeout, 404, 5xx, bad body)
 * answers empty and is logged, never thrown. Deliberately separate from {@code HttpAsignadorClient},
 * whose 30s read timeout and exception contract fit a ronda, not a best-effort lookup.
 */
@Slf4j
public class HttpRadioCensalClient implements RadioCensalClient {

    static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(1);
    static final Duration READ_TIMEOUT = Duration.ofSeconds(2);

    private final RestClient restClient;
    private final String uri;

    public HttpRadioCensalClient(RestClient.Builder restClientBuilder, String workerUrl) {
        this(restClientBuilder, workerUrl, requestFactory());
    }

    /** Test seam: a {@code null} factory leaves the builder's already-bound one (MockRestServiceServer). */
    HttpRadioCensalClient(RestClient.Builder restClientBuilder, String workerUrl, ClientHttpRequestFactory requestFactory) {
        this.uri = workerUrl + "/v1/radio";
        this.restClient = requestFactory != null
                ? restClientBuilder.requestFactory(requestFactory).build()
                : restClientBuilder.build();
    }

    static ClientHttpRequestFactory requestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) CONNECT_TIMEOUT.toMillis());
        factory.setReadTimeout((int) READ_TIMEOUT.toMillis());
        return factory;
    }

    @Override
    public Optional<String> resolver(double latitud, double longitud) {
        try {
            RadioResponse respuesta = restClient.post()
                    .uri(uri)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("latitud", latitud, "longitud", longitud))
                    .retrieve()
                    .body(RadioResponse.class);
            return Optional.ofNullable(respuesta).map(RadioResponse::codigoRadio).filter(c -> !c.isBlank());
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().isSameCodeAs(HttpStatus.NOT_FOUND)) {
                log.debug("[radio] no census radio contains the point");
            } else {
                log.warn("[radio] worker answered {} to the radio lookup", e.getStatusCode());
            }
            return Optional.empty();
        } catch (RuntimeException e) {
            log.warn("[radio] radio lookup failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private record RadioResponse(String codigoRadio) {
    }
}
