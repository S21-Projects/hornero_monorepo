package org.example.user;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.actividad.Actividad;
import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.auth.RefreshTokenRepository;
import org.example.auth.otp.CodigoVerificacion;
import org.example.auth.otp.CodigoVerificacionRepository;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.idempotencia.IdempotenciaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** N15/D12 end to end (H2): effects of an admin anonymization, as a real client sees them. */
@SpringBootTest
@AutoConfigureMockMvc
class UsuarioAnonimizacionIntegrationTest {

    private static final String PASSWORD = "Secreta-123!x";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private UsuarioRepository usuarioRepository;
    @Autowired
    private DonacionRepository donacionRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private CodigoVerificacionRepository codigoRepository;
    @Autowired
    private IdempotenciaRepository idempotenciaRepository;
    @Autowired
    private RefreshTokenRepository refreshTokenRepository;
    @Autowired
    private ActividadService actividadService;

    private String adminToken;
    private String email;
    private Donante donante;

    @BeforeEach
    void setUp() throws Exception {
        adminToken = login("admin@hornero.ar", "Admin123!").get("accessToken").asText();
        email = "borrar-" + UUID.randomUUID() + "@test.com";
        Donante d = new Donante(null, "Dora Donante", email, passwordEncoder.encode(PASSWORD), true);
        d.setEmailVerificado(true);
        donante = usuarioRepository.save(d);
    }

    private JsonNode login(String mail, String pass) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + mail + "\",\"password\":\"" + pass + "\"}"))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    private MvcResult anonimizar(Long id, String token, String key) throws Exception {
        var req = post("/api/usuarios/" + id + "/anonimizar").header("Authorization", "Bearer " + token);
        if (key != null) {
            req.header("Idempotency-Key", key);
        }
        return mockMvc.perform(req).andReturn();
    }

    private String message(MvcResult r) throws Exception {
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("message").asText();
    }

    @Test
    void anonymizedUser_cannotLogInRefreshOrUseTheOldToken() throws Exception {
        JsonNode sesion = login(email, PASSWORD);
        String access = sesion.get("accessToken").asText();
        String refresh = sesion.get("refreshToken").asText();
        assertThat(access).isNotBlank();

        MvcResult r = anonimizar(donante.getId(), adminToken, UUID.randomUUID().toString());

        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        assertThat(login(email, PASSWORD).has("accessToken")).isFalse();
        assertThat(mockMvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"" + refresh + "\"}")).andReturn().getResponse().getStatus())
                .isEqualTo(401);
        assertThat(mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + access))
                .andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(refreshTokenRepository.findAll().stream()
                .filter(t -> t.getUsuarioId().equals(donante.getId()))
                .allMatch(t -> t.getRevokedAt() != null)).isTrue();
    }

    @Test
    void storedRowIsScrubbed_andListedAsUsuarioEliminado() throws Exception {
        anonimizar(donante.getId(), adminToken, UUID.randomUUID().toString());

        Usuario u = usuarioRepository.findById(donante.getId()).orElseThrow();
        assertThat(u.getNombre()).isEqualTo("Usuario eliminado");
        assertThat(u.getEmail()).endsWith("@anonimo.invalid").doesNotContain(email);
        assertThat(u.isActivo()).isFalse();
        assertThat(usuarioRepository.findByEmail(email)).isEmpty();

        String lista = mockMvc.perform(get("/api/usuarios?size=100&sort=id,desc")
                        .header("Authorization", "Bearer " + adminToken))
                .andReturn().getResponse().getContentAsString();
        assertThat(lista).contains("Usuario eliminado").doesNotContain(email);
    }

    @Test
    void donationsKeepWorking_butShowTheAnonymizedDonor() throws Exception {
        Donacion d = new Donacion();
        d.setFechaOferta(LocalDate.now());
        d.setEstado(EstadoDonacion.ENTREGADA);
        d.setDonante(donante);
        d = donacionRepository.save(d);

        anonimizar(donante.getId(), adminToken, UUID.randomUUID().toString());

        String lista = mockMvc.perform(get("/api/donaciones?size=100&sort=id,desc")
                        .header("Authorization", "Bearer " + adminToken))
                .andReturn().getResponse().getContentAsString();
        JsonNode content = objectMapper.readTree(lista).path("data").path("content");
        boolean found = false;
        for (JsonNode n : content) {
            if (n.get("id").asLong() == d.getId()) {
                found = true;
                assertThat(n.get("donanteName").asText()).isEqualTo("Usuario eliminado");
            }
        }
        assertThat(found).isTrue();
        assertThat(lista).doesNotContain("Dora Donante").doesNotContain(email);
    }

    @Test
    void otpCodesAndIdempotencyKeysOfTheUser_areDeleted() throws Exception {
        CodigoVerificacion c = new CodigoVerificacion();
        c.setEmail(email);
        c.setCodigoHash("hash");
        c.setExpiraEn(Instant.now().plusSeconds(600));
        c.setCreadoEn(Instant.now());
        codigoRepository.save(c);
        idempotenciaRepository.save(org.example.idempotencia.ClaveIdempotencia.enProceso(
                donante.getId(), UUID.randomUUID().toString(), "POST /api/donaciones", "h",
                Instant.now(), Instant.now().plusSeconds(600)));

        anonimizar(donante.getId(), adminToken, UUID.randomUUID().toString());

        assertThat(codigoRepository.findTopByEmailAndUsadoFalseOrderByCreadoEnDesc(email)).isEmpty();
        assertThat(idempotenciaRepository.findAll().stream()
                .anyMatch(k -> k.getUsuarioId().equals(donante.getId()))).isFalse();
    }

    @Test
    void activityRowHasAdminActor_andNoPersonalData() throws Exception {
        anonimizar(donante.getId(), adminToken, UUID.randomUUID().toString());

        var filas = actividadService.buscar(new ActividadService.Filtro(null, TipoActividad.USUARIO_ANONIMIZADO,
                null, "USUARIO", donante.getId(), null, null), PageRequest.of(0, 5)).getContent();
        assertThat(filas).hasSize(1);
        Actividad a = filas.get(0);
        assertThat(a.getActorUsuarioId()).isNotNull().isNotEqualTo(donante.getId());
        String todo = String.valueOf(a.getDetalle()) + a.getAntes() + a.getDespues() + a.getMotivo() + a.getEmailIntento();
        assertThat(todo).doesNotContain("Dora").doesNotContain(email);
    }

    @Test
    void secondAnonymization_is409_andSameKeyReplays() throws Exception {
        String key = UUID.randomUUID().toString();
        MvcResult primera = anonimizar(donante.getId(), adminToken, key);
        MvcResult replay = anonimizar(donante.getId(), adminToken, key);
        MvcResult otra = anonimizar(donante.getId(), adminToken, UUID.randomUUID().toString());

        assertThat(primera.getResponse().getStatus()).isEqualTo(200);
        assertThat(replay.getResponse().getStatus()).isEqualTo(200);
        assertThat(replay.getResponse().getHeader("Idempotent-Replayed")).isEqualTo("true");
        assertThat(otra.getResponse().getStatus()).isEqualTo(409);
        assertThat(message(otra)).isEqualTo("USUARIO_YA_ANONIMIZADO");
    }

    @Test
    void missingIdempotencyKey_is400() throws Exception {
        MvcResult r = anonimizar(donante.getId(), adminToken, null);

        assertThat(r.getResponse().getStatus()).isEqualTo(400);
        assertThat(message(r)).isEqualTo("IDEMPOTENCY_KEY_REQUERIDA");
        assertThat(usuarioRepository.findById(donante.getId()).orElseThrow().getNombre()).isEqualTo("Dora Donante");
    }

    @Test
    void anonymizingYourself_isRejected() throws Exception {
        Long adminId = usuarioRepository.findByEmail("admin@hornero.ar").orElseThrow().getId();

        MvcResult r = anonimizar(adminId, adminToken, UUID.randomUUID().toString());

        assertThat(r.getResponse().getStatus()).isEqualTo(409);
        assertThat(message(r)).isEqualTo("ANONIMIZAR_CUENTA_PROPIA");
        assertThat(usuarioRepository.findById(adminId).orElseThrow().getEmail()).isEqualTo("admin@hornero.ar");
    }

    @Test
    void unknownUser_is404() throws Exception {
        assertThat(anonimizar(999_999L, adminToken, UUID.randomUUID().toString()).getResponse().getStatus())
                .isEqualTo(404);
    }
}
