package org.example.organizacion.radio;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** Best-effort client of the worker's POST /v1/radio: it answers a code or empty, never throws. */
class HttpRadioCensalClientTest {

    private static final String WORKER_URL = "http://worker-test:8090";

    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final HttpRadioCensalClient client = new HttpRadioCensalClient(builder, WORKER_URL, null);

    @Test
    void foundRadio_isReturned() {
        server.expect(requestTo(WORKER_URL + "/v1/radio"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().json("{\"latitud\":-31.4167,\"longitud\":-64.1833}", true))
                .andRespond(withSuccess("{\"codigoRadio\":\"140145516\"}", MediaType.APPLICATION_JSON));

        Optional<String> radio = client.resolver(-31.4167, -64.1833);

        server.verify();
        assertThat(radio).contains("140145516");
    }

    @Test
    void radioNotFound_isEmpty() {
        server.expect(requestTo(WORKER_URL + "/v1/radio"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"RADIO_NO_ENCONTRADO\",\"detalle\":\"x\"}"));

        assertThat(client.resolver(0, 0)).isEmpty();
    }

    @Test
    void workerError_isEmptyAndNeverThrows() {
        server.expect(requestTo(WORKER_URL + "/v1/radio")).andRespond(withServerError());

        assertThat(client.resolver(-31.4167, -64.1833)).isEmpty();
    }
}
