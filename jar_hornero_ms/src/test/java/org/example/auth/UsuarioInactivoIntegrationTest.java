package org.example.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.example.user.UsuarioService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * N9/D9: deactivating a user cuts access immediately. The access token is still cryptographically
 * valid for up to 15 minutes, so the filter must consult the database on every request. Refresh
 * families are revoked at deactivation (S3), so the refresh token must fail too.
 */
@SpringBootTest
@AutoConfigureMockMvc
class UsuarioInactivoIntegrationTest {

    private static final String EMAIL = "referente3@hornero.ar";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private UsuarioService usuarioService;

    @AfterEach
    void reactivate() {
        Usuario u = usuarioRepository.findByEmail(EMAIL).orElseThrow();
        if (!u.isActivo()) {
            usuarioService.toggleActivo(u.getId(), true);
        }
    }

    private JsonNode login() throws Exception {
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + EMAIL + "\",\"password\":\"Ref123!\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    private void deactivate() {
        usuarioService.toggleActivo(usuarioRepository.findByEmail(EMAIL).orElseThrow().getId(), false);
    }

    @Test
    void activeUser_accessTokenWorks() throws Exception {
        String access = login().get("accessToken").asText();

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + access))
                .andExpect(status().isOk());
    }

    @Test
    void deactivatedMidSession_meAnswers401UsuarioInactivo() throws Exception {
        String access = login().get("accessToken").asText();
        deactivate();

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + access))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("USUARIO_INACTIVO"));
    }

    @Test
    void deactivatedMidSession_protectedEndpointAnswers401UsuarioInactivo() throws Exception {
        String access = login().get("accessToken").asText();
        deactivate();

        // authenticated()-only route (entry point path)
        mockMvc.perform(get("/api/donaciones/1/entrega").header("Authorization", "Bearer " + access))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("USUARIO_INACTIVO"));
        // role-gated route (anonymous -> access denied path)
        mockMvc.perform(get("/api/rondas").header("Authorization", "Bearer " + access))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("USUARIO_INACTIVO"));
    }

    @Test
    void deactivatedMidSession_publicGetStillServesAsAnonymous() throws Exception {
        String access = login().get("accessToken").asText();
        deactivate();

        mockMvc.perform(get("/api/necesidades").header("Authorization", "Bearer " + access))
                .andExpect(status().isOk());
    }

    @Test
    void deactivated_refreshTokenFailsToo() throws Exception {
        String refresh = login().get("refreshToken").asText();
        deactivate();

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refresh + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void reactivated_newLoginWorksAgain() throws Exception {
        deactivate();
        usuarioService.toggleActivo(usuarioRepository.findByEmail(EMAIL).orElseThrow().getId(), true);

        String access = login().get("accessToken").asText();
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + access))
                .andExpect(status().isOk());
    }

    @Test
    void anonymousProtectedRequest_keepsGenericDenial() throws Exception {
        mockMvc.perform(get("/api/rondas"))
                .andExpect(status().isForbidden());
    }
}
