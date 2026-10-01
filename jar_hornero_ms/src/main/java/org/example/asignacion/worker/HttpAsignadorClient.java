package org.example.asignacion.worker;

import org.example.asignacion.worker.dto.EntradaRondaV1;
import org.example.asignacion.worker.dto.SalidaRondaV1;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;

/**
 * HTTP implementation of {@link AsignadorClient} (AD-1): calls the worker's {@code POST /v1/ronda}
 * using Spring's {@link RestClient}. Connect timeout 2s / read timeout 30s, per AD-1's "the MS does
 * not {@code depends_on} the worker" posture — a slow/unreachable worker must fail fast rather than
 * hang the ronda-triggering request.
 */
public class HttpAsignadorClient implements AsignadorClient {

    static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(2);
    static final Duration READ_TIMEOUT = Duration.ofSeconds(30);

    private final RestClient restClient;
    private final String uri;

    public HttpAsignadorClient(RestClient.Builder restClientBuilder, String workerUrl) {
        this(restClientBuilder, workerUrl, requestFactory());
    }

    /**
     * Package-private seam for tests: pass {@code requestFactory = null} to leave the builder's
     * already-bound factory untouched (e.g. {@code MockRestServiceServer.bindTo(builder)}), instead
     * of overriding it with the real timeout-configured factory.
     */
    HttpAsignadorClient(RestClient.Builder restClientBuilder, String workerUrl, ClientHttpRequestFactory requestFactory) {
        this.uri = workerUrl + "/v1/ronda";
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
    public SalidaRondaV1 ejecutar(EntradaRondaV1 entrada) {
        try {
            SalidaRondaV1 salida = restClient.post()
                    .uri(uri)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(entrada)
                    .retrieve()
                    .body(SalidaRondaV1.class);
            if (salida == null) {
                throw new AsignadorRespuestaInvalidaException("El worker devolvió un cuerpo vacío");
            }
            return salida;
        } catch (ResourceAccessException e) {
            throw new AsignadorNoDisponibleException("Worker inalcanzable o timeout: " + e.getMessage(), e);
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().is5xxServerError()) {
                throw new AsignadorNoDisponibleException(
                        "Worker respondió con un error de servidor: " + e.getStatusCode(), e);
            }
            throw new AsignadorRespuestaInvalidaException(
                    "Worker respondió con un estado inesperado: " + e.getStatusCode(), e);
        } catch (RestClientException e) {
            throw new AsignadorRespuestaInvalidaException("Respuesta del worker inválida: " + e.getMessage(), e);
        }
    }
}
