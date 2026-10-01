package org.example.asignacion.worker;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.asignacion.worker.dto.EntradaRondaV1;
import org.example.asignacion.worker.dto.SalidaRondaV1;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.nio.file.Files;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * HTTP implementation of {@code AsignadorClient} (AD-1, slice 5c-ii): request/response fidelity
 * against the golden fixtures copied from {@code go_algorithms_worker/testdata/ronda-v1/}, and the
 * worker-down/malformed-response mapping to {@link AsignadorNoDisponibleException} /
 * {@link AsignadorRespuestaInvalidaException}.
 */
class HttpAsignadorClientTest {

    private static final String WORKER_URL = "http://worker-test:8090";
    private final ObjectMapper objectMapper = new ObjectMapper();

    private String resource(String name) throws IOException {
        return Files.readString(new ClassPathResource("contract/" + name).getFile().toPath());
    }

    @Test
    void requestSerializesToExactlyTheGoldenRequest() throws Exception {
        String goldenRequest = resource("request.json");
        String goldenResponse = resource("response.json");
        EntradaRondaV1 entrada = objectMapper.readValue(goldenRequest, EntradaRondaV1.class);

        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpAsignadorClient client = new HttpAsignadorClient(builder, WORKER_URL, null);

        server.expect(requestTo(WORKER_URL + "/v1/ronda"))
                .andExpect(method(org.springframework.http.HttpMethod.POST))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(content().json(goldenRequest, true))
                .andRespond(withSuccess(goldenResponse, MediaType.APPLICATION_JSON));

        SalidaRondaV1 salida = client.ejecutar(entrada);

        server.verify();
        assertThat(salida.getAsignaciones()).hasSize(1);
        assertThat(salida.getAsignaciones().get(0).getDonacionId()).isEqualTo(17L);
        assertThat(salida.getAsignaciones().get(0).getNecesidadId()).isEqualTo(40L);
        assertThat(salida.getScoreTotal()).isEqualTo(0.5326855684846372);
    }

    @Test
    void responseDeserializesToExactlyTheGoldenResponse() throws Exception {
        String goldenResponse = resource("response.json");
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpAsignadorClient client = new HttpAsignadorClient(builder, WORKER_URL, null);

        server.expect(requestTo(WORKER_URL + "/v1/ronda"))
                .andRespond(withSuccess(goldenResponse, MediaType.APPLICATION_JSON));

        SalidaRondaV1 salida = client.ejecutar(new EntradaRondaV1());

        assertThat(salida.getPesos().getDeficit()).isEqualTo(0.3);
        assertThat(salida.getAsignaciones().get(0).getDesglose().getProximidad()).isEqualTo(0.759588311347539);
        assertThat(salida.getAsignaciones().get(0).getDesglose().getCumplimiento()).isEqualTo(0.888888888888889);
        assertThat(salida.getAsignaciones().get(0).getDeficitFuente()).isEqualTo("NEUTRAL");
    }

    @Test
    void connectAndReadTimeoutsAreConfigured() {
        assertThat(HttpAsignadorClient.CONNECT_TIMEOUT).isEqualTo(Duration.ofSeconds(2));
        assertThat(HttpAsignadorClient.READ_TIMEOUT).isEqualTo(Duration.ofSeconds(30));
    }

    @Test
    void workerUnreachable_throwsAsignadorNoDisponible() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpAsignadorClient client = new HttpAsignadorClient(builder, WORKER_URL, null);

        server.expect(requestTo(WORKER_URL + "/v1/ronda"))
                .andRespond(withServerError());

        assertThatThrownBy(() -> client.ejecutar(new EntradaRondaV1()))
                .isInstanceOf(AsignadorNoDisponibleException.class);
    }

    /**
     * Distinguishes a worker-down / connection-refused failure (surfaced by {@code RestClient} as
     * {@link org.springframework.web.client.ResourceAccessException}) from a malformed-response
     * failure: both must map to {@link AsignadorNoDisponibleException} per AD-1, never to
     * {@link AsignadorRespuestaInvalidaException}. Uses the real {@link HttpAsignadorClient}
     * constructor (real timeout-configured request factory) against a closed local port, so the
     * connection genuinely fails instead of being mocked.
     */
    @Test
    void workerConnectionRefused_throwsAsignadorNoDisponible() throws Exception {
        int unusedPort;
        try (java.net.ServerSocket socket = new java.net.ServerSocket(0)) {
            unusedPort = socket.getLocalPort();
        }
        HttpAsignadorClient client = new HttpAsignadorClient(RestClient.builder(), "http://127.0.0.1:" + unusedPort);

        assertThatThrownBy(() -> client.ejecutar(new EntradaRondaV1()))
                .isInstanceOf(AsignadorNoDisponibleException.class);
    }

    @Test
    void workerMalformedResponse_throwsAsignadorRespuestaInvalida() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpAsignadorClient client = new HttpAsignadorClient(builder, WORKER_URL, null);

        server.expect(requestTo(WORKER_URL + "/v1/ronda"))
                .andRespond(withSuccess("{not-json", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.ejecutar(new EntradaRondaV1()))
                .isInstanceOf(AsignadorRespuestaInvalidaException.class);
    }

    @Test
    void workerClientError_throwsAsignadorRespuestaInvalida() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpAsignadorClient client = new HttpAsignadorClient(builder, WORKER_URL, null);

        server.expect(requestTo(WORKER_URL + "/v1/ronda"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.BAD_REQUEST)
                        .body("{\"error\":\"VERSION_NO_SOPORTADA\"}")
                        .contentType(MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.ejecutar(new EntradaRondaV1()))
                .isInstanceOf(AsignadorRespuestaInvalidaException.class);
    }

    @Test
    void blankWorkerUrl_asignadorConfigYieldsNoConfiguradoClient_throwsAsignadorNoDisponible() {
        AsignadorConfig config = new AsignadorConfig();
        AsignadorClient client = config.asignadorClient(RestClient.builder(), "");

        assertThat(client).isInstanceOf(AsignadorNoConfiguradoClient.class);
        assertThatThrownBy(() -> client.ejecutar(new EntradaRondaV1()))
                .isInstanceOf(AsignadorNoDisponibleException.class);
    }

    @Test
    void configuredWorkerUrl_asignadorConfigYieldsHttpAsignadorClient() {
        AsignadorConfig config = new AsignadorConfig();
        AsignadorClient client = config.asignadorClient(RestClient.builder(), "http://worker:8090");

        assertThat(client).isInstanceOf(HttpAsignadorClient.class);
    }
}
