package org.example.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** With a zero grace window any replay of a rotated token is treated as theft. */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.jwt.refresh-reuse-grace-seconds=0")
class RefreshTokenReuseDetectionIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private JsonNode call(String path, String body) throws Exception {
        var result = mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();
        return objectMapper.readTree("{\"status\":" + result.getResponse().getStatus() + ","
                + "\"body\":" + (result.getResponse().getContentAsString().isBlank()
                ? "{}" : result.getResponse().getContentAsString()) + "}");
    }

    @Test
    void replayAfterGrace_revokesTheWholeFamily_includingTheNewerToken() throws Exception {
        String first = call("/api/auth/login", "{\"email\":\"admin@hornero.ar\",\"password\":\"Admin123!\"}")
                .get("body").get("refreshToken").asText();
        String second = call("/api/auth/refresh", "{\"refreshToken\":\"" + first + "\"}")
                .get("body").get("refreshToken").asText();

        assertThat(call("/api/auth/refresh", "{\"refreshToken\":\"" + first + "\"}").get("status").asInt())
                .isEqualTo(401);

        assertThat(call("/api/auth/refresh", "{\"refreshToken\":\"" + second + "\"}").get("status").asInt())
                .isEqualTo(401);
    }
}
