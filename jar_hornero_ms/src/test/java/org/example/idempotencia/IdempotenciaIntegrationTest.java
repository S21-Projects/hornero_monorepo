package org.example.idempotencia;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.domain.ArticuloRepository;
import org.example.articulo.ArticuloService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * N11: Idempotency-Key end to end against the real filter, service and repository (H2). Uses
 * {@code POST /api/articulos} (ADMINISTRADOR, creates a row) as the probe endpoint.
 */
@SpringBootTest
@AutoConfigureMockMvc
class IdempotenciaIntegrationTest {

    private static final String PATH = "/api/articulos";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private ArticuloRepository articuloRepository;
    @Autowired
    private IdempotenciaRepository idempotenciaRepository;
    @Autowired
    private IdempotenciaService idempotenciaService;
    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;
    @SpyBean
    private ArticuloService articuloService;

    private String adminToken;

    @BeforeEach
    void login() throws Exception {
        Mockito.reset(articuloService);
        adminToken = loginToken("admin@hornero.ar", "Admin123!");
    }

    private String loginToken(String email, String password) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("accessToken").asText();
    }

    private static String body(String nombre) {
        return "{\"nombre\":\"" + nombre + "\",\"categoria\":\"NO_PERECEDERO\",\"unidad\":\"KG\"}";
    }

    private MockHttpServletRequestBuilder req(String token, String key, String json) {
        MockHttpServletRequestBuilder b = post(PATH)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json);
        if (key != null) {
            b.header("Idempotency-Key", key);
        }
        return b;
    }

    private static String uuid() {
        return UUID.randomUUID().toString();
    }

    @Test
    void missingKey_is400() throws Exception {
        MvcResult r = mockMvc.perform(req(adminToken, null, body("Sin clave " + uuid()))).andReturn();

        assertThat(r.getResponse().getStatus()).isEqualTo(400);
        assertThat(objectMapper.readTree(r.getResponse().getContentAsString()).get("message").asText())
                .isEqualTo("IDEMPOTENCY_KEY_REQUERIDA");
    }

    @Test
    void malformedKey_is400() throws Exception {
        MvcResult r = mockMvc.perform(req(adminToken, "not-a-uuid", body("Mala clave " + uuid()))).andReturn();

        assertThat(r.getResponse().getStatus()).isEqualTo(400);
        assertThat(objectMapper.readTree(r.getResponse().getContentAsString()).get("message").asText())
                .isEqualTo("IDEMPOTENCY_KEY_INVALIDA");
    }

    @Test
    void firstRequest_runsAndIsNotMarkedReplayed() throws Exception {
        MvcResult r = mockMvc.perform(req(adminToken, uuid(), body("Primero " + uuid()))).andReturn();

        assertThat(r.getResponse().getStatus()).isEqualTo(201);
        assertThat(r.getResponse().getHeader("Idempotent-Replayed")).isNull();
    }

    @Test
    void sameKeySamePayload_replaysOriginalAndDoesNotCreateTwice() throws Exception {
        String key = uuid();
        String nombre = "Replay " + uuid();
        long antes = articuloRepository.count();

        MvcResult first = mockMvc.perform(req(adminToken, key, body(nombre))).andReturn();
        MvcResult second = mockMvc.perform(req(adminToken, key, body(nombre))).andReturn();

        assertThat(first.getResponse().getStatus()).isEqualTo(201);
        assertThat(second.getResponse().getStatus()).isEqualTo(201);
        assertThat(second.getResponse().getHeader("Idempotent-Replayed")).isEqualTo("true");
        JsonNode a = objectMapper.readTree(first.getResponse().getContentAsString());
        JsonNode b = objectMapper.readTree(second.getResponse().getContentAsString());
        assertThat(b.get("data").get("id")).isEqualTo(a.get("data").get("id"));
        assertThat(articuloRepository.count()).isEqualTo(antes + 1);
    }

    @Test
    void sameKeyReorderedJsonAndWhitespace_isTheSamePayload() throws Exception {
        String key = uuid();
        String nombre = "Canonico " + uuid();
        String a = "{\"nombre\":\"" + nombre + "\",\"categoria\":\"NO_PERECEDERO\",\"unidad\":\"KG\"}";
        String b = "{ \"unidad\": \"KG\",\n \"nombre\": \"" + nombre + "\", \"categoria\": \"NO_PERECEDERO\" }";

        mockMvc.perform(req(adminToken, key, a)).andReturn();
        MvcResult second = mockMvc.perform(req(adminToken, key, b)).andReturn();

        assertThat(second.getResponse().getStatus()).isEqualTo(201);
        assertThat(second.getResponse().getHeader("Idempotent-Replayed")).isEqualTo("true");
    }

    @Test
    void sameKeyDifferentPayload_is422() throws Exception {
        String key = uuid();
        mockMvc.perform(req(adminToken, key, body("Uno " + uuid()))).andReturn();

        MvcResult r = mockMvc.perform(req(adminToken, key, body("Dos " + uuid()))).andReturn();

        assertThat(r.getResponse().getStatus()).isEqualTo(422);
        assertThat(objectMapper.readTree(r.getResponse().getContentAsString()).get("message").asText())
                .isEqualTo("IDEMPOTENCIA_PAYLOAD_DISTINTO");
    }

    @Test
    void businessError_isStoredAndReplayedToo() throws Exception {
        String key = uuid();
        String invalido = "{\"nombre\":\"\",\"categoria\":\"NO_PERECEDERO\",\"unidad\":\"KG\"}";

        MvcResult first = mockMvc.perform(req(adminToken, key, invalido)).andReturn();
        MvcResult second = mockMvc.perform(req(adminToken, key, invalido)).andReturn();

        assertThat(first.getResponse().getStatus()).isEqualTo(400);
        assertThat(second.getResponse().getStatus()).isEqualTo(400);
        assertThat(second.getResponse().getHeader("Idempotent-Replayed")).isEqualTo("true");
    }

    @Test
    void serverError_releasesTheKeySoRetryRuns() throws Exception {
        String key = uuid();
        String nombre = "Retry " + uuid();
        doThrow(new IllegalStateException("boom")).when(articuloService).crear(any());

        MvcResult first = mockMvc.perform(req(adminToken, key, body(nombre))).andReturn();
        assertThat(first.getResponse().getStatus()).isEqualTo(500);

        Mockito.reset(articuloService);
        MvcResult retry = mockMvc.perform(req(adminToken, key, body(nombre))).andReturn();

        assertThat(retry.getResponse().getStatus()).isEqualTo(201);
        assertThat(retry.getResponse().getHeader("Idempotent-Replayed")).isNull();
    }

    @Test
    void forbiddenResponse_isNotStored() throws Exception {
        String key = uuid();
        String referente = loginToken("referente@hornero.ar", "Ref123!");

        MvcResult denied = mockMvc.perform(req(referente, key, body("Prohibido " + uuid()))).andReturn();
        // same key now used by the admin: must run, not replay the 403 (different user scope anyway)
        MvcResult ok = mockMvc.perform(req(adminToken, key, body("Permitido " + uuid()))).andReturn();

        assertThat(denied.getResponse().getStatus()).isEqualTo(403);
        assertThat(ok.getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    void sameKeyFromDifferentUsers_isIndependent() throws Exception {
        String key = uuid();
        String nombre = "Compartida " + uuid();
        String otroAdminToken = adminToken;
        // Only one seeded admin exists, so isolate by storing a row directly for another user id.
        idempotenciaRepository.saveAndFlush(ClaveIdempotencia.enProceso(
                -999L, key, "POST " + PATH, "0".repeat(64), Instant.now(), Instant.now().plus(Duration.ofHours(24))));

        MvcResult r = mockMvc.perform(req(otroAdminToken, key, body(nombre))).andReturn();

        assertThat(r.getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    void sameKeyWhileFirstIsInFlight_is409() throws Exception {
        String key = uuid();
        String nombre = "Concurrente " + uuid();
        CountDownLatch dentro = new CountDownLatch(1);
        CountDownLatch soltar = new CountDownLatch(1);
        doAnswer(inv -> {
            dentro.countDown();
            soltar.await(10, TimeUnit.SECONDS);
            return inv.callRealMethod();
        }).when(articuloService).crear(any());

        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<MvcResult> primera = pool.submit(() -> mockMvc.perform(req(adminToken, key, body(nombre))).andReturn());
            assertThat(dentro.await(10, TimeUnit.SECONDS)).isTrue();

            MvcResult segunda = mockMvc.perform(req(adminToken, key, body(nombre))).andReturn();
            soltar.countDown();
            MvcResult original = primera.get(10, TimeUnit.SECONDS);

            assertThat(segunda.getResponse().getStatus()).isEqualTo(409);
            assertThat(objectMapper.readTree(segunda.getResponse().getContentAsString()).get("message").asText())
                    .isEqualTo("IDEMPOTENCIA_EN_PROCESO");
            assertThat(original.getResponse().getStatus()).isEqualTo(201);
        } finally {
            soltar.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    void staleInProcessKey_canBeTakenOver() throws Exception {
        String key = uuid();
        String nombre = "Abandonada " + uuid();
        Instant hace10min = Instant.now().minus(Duration.ofMinutes(10));
        // A crashed request left EN_PROCESO behind with the same fingerprint the retry will compute.
        mockMvc.perform(req(adminToken, key, body(nombre))).andReturn();
        ClaveIdempotencia c = idempotenciaRepository.findAll().stream()
                .filter(x -> x.getClave().equals(key)).findFirst().orElseThrow();
        jdbc.update("update idempotency_keys set estado = 'EN_PROCESO', creada_en = ? where id = ?",
                java.sql.Timestamp.from(hace10min), c.getId());

        MvcResult retry = mockMvc.perform(req(adminToken, key, body(nombre))).andReturn();

        assertThat(retry.getResponse().getStatus()).isEqualTo(201);
        assertThat(retry.getResponse().getHeader("Idempotent-Replayed")).isNull();
    }

    @Test
    void expiredKey_isANewOperation() throws Exception {
        String key = uuid();
        String nombre = "Expirada " + uuid();
        long antes = articuloRepository.count();
        mockMvc.perform(req(adminToken, key, body(nombre))).andReturn();
        ClaveIdempotencia c = idempotenciaRepository.findAll().stream()
                .filter(x -> x.getClave().equals(key)).findFirst().orElseThrow();
        jdbc.update("update idempotency_keys set expira_en = ? where id = ?",
                java.sql.Timestamp.from(Instant.now().minusSeconds(60)), c.getId());

        MvcResult again = mockMvc.perform(req(adminToken, key, body(nombre))).andReturn();

        assertThat(again.getResponse().getStatus()).isEqualTo(201);
        assertThat(again.getResponse().getHeader("Idempotent-Replayed")).isNull();
        assertThat(articuloRepository.count()).isEqualTo(antes + 2);
    }

    @Test
    void purge_removesOnlyExpiredKeys() throws Exception {
        String viva = uuid();
        String muerta = uuid();
        mockMvc.perform(req(adminToken, viva, body("Viva " + uuid()))).andReturn();
        mockMvc.perform(req(adminToken, muerta, body("Muerta " + uuid()))).andReturn();
        ClaveIdempotencia c = idempotenciaRepository.findAll().stream()
                .filter(x -> x.getClave().equals(muerta)).findFirst().orElseThrow();
        jdbc.update("update idempotency_keys set expira_en = ? where id = ?",
                java.sql.Timestamp.from(Instant.now().minusSeconds(60)), c.getId());

        int borradas = idempotenciaService.purgarExpiradas();

        assertThat(borradas).isGreaterThanOrEqualTo(1);
        assertThat(idempotenciaRepository.findAll()).noneMatch(x -> x.getClave().equals(muerta));
        assertThat(idempotenciaRepository.findAll()).anyMatch(x -> x.getClave().equals(viva));
    }

    @Test
    void nonAnnotatedPost_doesNotRequireKey() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"admin@hornero.ar\",\"password\":\"Admin123!\"}")).andReturn();

        assertThat(r.getResponse().getStatus()).isEqualTo(200);
    }
}
