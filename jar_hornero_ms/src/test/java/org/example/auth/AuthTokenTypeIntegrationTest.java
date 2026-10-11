package org.example.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Token-type separation end to end: a refresh token must never authenticate a request and an
 * access token must never be accepted as a refresh token. Uses the seeded admin from DataInitializer.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AuthTokenTypeIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private JsonNode login() throws Exception {
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@hornero.ar\",\"password\":\"Admin123!\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    private int meStatus(String token) throws Exception {
        return mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getStatus();
    }

    private int refreshStatus(String token) throws Exception {
        return mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + token + "\"}"))
                .andReturn().getResponse().getStatus();
    }

    @Test
    void accessToken_authenticatesProtectedEndpoint() throws Exception {
        assertThat(meStatus(login().get("accessToken").asText())).isEqualTo(200);
    }

    @Test
    void refreshToken_onProtectedEndpoint_isTreatedLikeAnInvalidToken() throws Exception {
        assertThat(meStatus("garbage")).isEqualTo(401);
        assertThat(meStatus(login().get("refreshToken").asText())).isEqualTo(401);
    }

    @Test
    void accessToken_onRefresh_returns401() throws Exception {
        assertThat(refreshStatus(login().get("accessToken").asText())).isEqualTo(401);
    }

    @Test
    void refreshToken_onRefresh_issuesNewTokens() throws Exception {
        String refreshToken = login().get("refreshToken").asText();

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refreshToken + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists())
                .andExpect(jsonPath("$.refreshToken").exists());
    }

    @Test
    void refresh_blankBody_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"\"}"))
                .andExpect(status().isBadRequest());
    }
}
