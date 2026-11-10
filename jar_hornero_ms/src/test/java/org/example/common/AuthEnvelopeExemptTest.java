package org.example.common;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * T-MS-22: POST /api/auth/login MUST return raw AuthResponse — no envelope wrapper.
 *
 * Mirrors OpenApiEnvelopeExemptTest. Uses @SpringBootTest (full context with H2)
 * so real authentication runs and the advice exemption can be verified end-to-end.
 * DataInitializer seeds admin@hornero.ar / Admin123! via @PostConstruct.
 *
 * RED: fails before ApiResponseAdvice exempts /api/auth/ ($.accessToken is nested under $.data).
 * GREEN: passes after the exemption is added.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AuthEnvelopeExemptTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void postLogin_returnsRawAuthResponse_notWrappedInEnvelope() throws Exception {
        String requestBody = """
                {"email":"admin@hornero.ar","password":"Admin123!"}
                """;

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                // Raw AuthResponse fields MUST be at the root level
                .andExpect(jsonPath("$.accessToken").exists())
                .andExpect(jsonPath("$.refreshToken").exists())
                // The envelope wrapper MUST NOT be present
                .andExpect(jsonPath("$.data").doesNotExist());
    }
}
