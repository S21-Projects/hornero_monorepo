package org.example.auth.reset;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.actividad.ActividadService;
import org.example.actividad.ResultadoActividad;
import org.example.actividad.TipoActividad;
import org.example.auth.RefreshTokenRepository;
import org.example.mail.Mailer;
import org.example.mail.MensajeCorreo;
import org.example.user.Donante;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Full forgot-password flow with the real repositories, real filters and a capturing {@link Mailer}.
 * Deliberately not {@code @Transactional}: the service commits its own transactions and the
 * failure/audit rows must survive, exactly like in production. This is how the flow is covered
 * end to end, because the token is only ever delivered by email (no test backdoor in prod code).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(PasswordResetIntegrationTest.CapturingMailerConfig.class)
class PasswordResetIntegrationTest {

    static final List<MensajeCorreo> ENVIADOS = new CopyOnWriteArrayList<>();

    @TestConfiguration
    static class CapturingMailerConfig {
        @Bean
        @Primary
        Mailer capturingMailer() {
            return ENVIADOS::add;
        }
    }

    private static final String VIEJA = "vieja-contraseña-larga-1234";
    private static final String NUEVA = "la cafetera azul canta fuerte";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private PasswordResetTokenRepository tokenRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private BCryptPasswordEncoder encoder;
    @Autowired private ActividadService actividadService;

    private String email;

    @BeforeEach
    void setUp() {
        ENVIADOS.clear();
        email = "reset-" + UUID.randomUUID() + "@example.com";
        usuarioRepository.save(new Donante(null, "Marta Gómez", email, encoder.encode(VIEJA), true));
    }

    private int olvido(String correo) throws Exception {
        return mockMvc.perform(post("/api/auth/password/olvido").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + correo + "\"}"))
                .andReturn().getResponse().getStatus();
    }

    private String olvidoBody(String correo) throws Exception {
        return mockMvc.perform(post("/api/auth/password/olvido").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + correo + "\"}"))
                .andReturn().getResponse().getContentAsString();
    }

    private org.springframework.test.web.servlet.ResultActions restablecer(String token, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/password/restablecer").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of("token", token, "password", password))));
    }

    private String tokenDelUltimoMail() {
        MensajeCorreo m = ENVIADOS.get(ENVIADOS.size() - 1);
        String text = m.text();
        return text.substring(text.indexOf("token=") + 6).lines().findFirst().orElseThrow().trim();
    }

    private int login(String correo, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of("email", correo, "password", password))))
                .andReturn().getResponse().getStatus();
    }

    @Test
    void olvido_knownAndUnknownEmail_getTheSameStatusAndBody() throws Exception {
        String conocido = olvidoBody(email);
        String desconocido = olvidoBody("nadie-" + UUID.randomUUID() + "@example.com");

        assertThat(conocido).isEqualTo(desconocido);
        assertThat(olvido(email)).isEqualTo(202);
        mockMvc.perform(post("/api/auth/password/olvido").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.mensaje").value("Si el email está registrado, te enviamos un enlace"));
    }

    @Test
    void olvido_unknownEmail_sendsNothing() throws Exception {
        olvido("nadie-" + UUID.randomUUID() + "@example.com");

        assertThat(ENVIADOS).isEmpty();
    }

    @Test
    void olvido_invalidEmailShape_is400() throws Exception {
        mockMvc.perform(post("/api/auth/password/olvido").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"no-es-un-email\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void fullFlow_resetsThePassword_revokesSessions_andTheLinkIsSingleUse() throws Exception {
        // an active session that must die with the reset
        assertThat(login(email, VIEJA)).isEqualTo(200);
        Long usuarioId = usuarioRepository.findByEmail(email).orElseThrow().getId();
        assertThat(refreshTokenRepository.findAll()).anyMatch(t -> t.getUsuarioId().equals(usuarioId) && t.getRevokedAt() == null);

        assertThat(olvido(email)).isEqualTo(202);
        assertThat(ENVIADOS).hasSize(1);
        String token = tokenDelUltimoMail();
        assertThat(ENVIADOS.get(0).to()).isEqualTo(email);

        // only the hash is at rest
        assertThat(tokenRepository.findAll()).noneMatch(t -> t.getTokenHash().contains(token));
        assertThat(tokenRepository.findByTokenHash(PasswordResetService.hash(token))).isPresent();

        restablecer(token, NUEVA).andExpect(status().isOk());

        assertThat(login(email, NUEVA)).isEqualTo(200);
        assertThat(login(email, VIEJA)).isEqualTo(401);
        assertThat(refreshTokenRepository.findAll()
                .stream().filter(t -> t.getUsuarioId().equals(usuarioId))
                .filter(t -> t.getRevokedAt() == null).count())
                .isEqualTo(1);  // only the session created by the login right after the reset
        // second use of the same link
        restablecer(token, "otra-contraseña-larga-9876").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("TOKEN_INVALIDO"));
        assertThat(login(email, NUEVA)).isEqualTo(200);
        // confirmation mail went out, without the password or the token
        assertThat(ENVIADOS).hasSize(2);
        assertThat(ENVIADOS.get(1).text()).doesNotContain(NUEVA).doesNotContain(token);

        var completados = actividadService.buscar(new ActividadService.Filtro(usuarioId,
                TipoActividad.PASSWORD_RESET_COMPLETADO, ResultadoActividad.EXITO, null, null, null, null),
                PageRequest.of(0, 10)).getContent();
        assertThat(completados).hasSize(1);
    }

    @Test
    void newRequest_invalidatesTheEarlierLink() throws Exception {
        olvido(email);
        String primero = tokenDelUltimoMail();
        olvido(email);
        String segundo = tokenDelUltimoMail();

        assertThat(primero).isNotEqualTo(segundo);
        restablecer(primero, NUEVA).andExpect(status().isBadRequest());
        restablecer(segundo, NUEVA).andExpect(status().isOk());
    }

    @Test
    void expiredToken_isRejected() throws Exception {
        olvido(email);
        String token = tokenDelUltimoMail();
        PasswordResetToken fila = tokenRepository.findByTokenHash(PasswordResetService.hash(token)).orElseThrow();
        fila.setExpiraEn(Instant.now().minusSeconds(5));
        tokenRepository.save(fila);

        restablecer(token, NUEVA).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("TOKEN_INVALIDO"));
        assertThat(login(email, VIEJA)).isEqualTo(200);
    }

    @Test
    void weakPassword_isRejectedAndTheLinkStaysUsable() throws Exception {
        olvido(email);
        String token = tokenDelUltimoMail();

        restablecer(token, "corta").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("PASSWORD_DEMASIADO_CORTA"));
        restablecer(token, NUEVA).andExpect(status().isOk());
    }

    @Test
    void unknownToken_isRejected_andTheFailureIsRecorded() throws Exception {
        restablecer("token-que-nunca-existio-" + UUID.randomUUID(), NUEVA)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("TOKEN_INVALIDO"));

        var fallidos = actividadService.buscar(new ActividadService.Filtro(null,
                TipoActividad.PASSWORD_RESET_FALLIDO, ResultadoActividad.FALLO, null, null, null, null),
                PageRequest.of(0, 50)).getContent();
        assertThat(fallidos).anyMatch(a -> "TOKEN_DESCONOCIDO".equals(a.getDetalle()));
        assertThat(fallidos.toString()).doesNotContain("token-que-nunca-existio");
    }

    @Test
    void deactivatedUser_cannotUseAnAlreadyIssuedLink() throws Exception {
        olvido(email);
        String token = tokenDelUltimoMail();
        var u = usuarioRepository.findByEmail(email).orElseThrow();
        u.setActivo(false);
        usuarioRepository.save(u);

        restablecer(token, NUEVA).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("TOKEN_INVALIDO"));
    }

    @Test
    void unverifiedEmail_becomesVerified_afterAResetProvedInboxControl() throws Exception {
        var u = usuarioRepository.findByEmail(email).orElseThrow();
        u.setEmailVerificado(false);
        usuarioRepository.save(u);

        olvido(email);
        restablecer(tokenDelUltimoMail(), NUEVA).andExpect(status().isOk());

        assertThat(usuarioRepository.findByEmail(email).orElseThrow().isEmailVerificado()).isTrue();
    }

    @Test
    void restablecer_blankOrMissingFields_are400() throws Exception {
        mockMvc.perform(post("/api/auth/password/restablecer").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest());
        JsonNode ignored = null;
    }
}
