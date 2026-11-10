package org.example.common;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * T-MS-21: GET /v3/api-docs MUST return raw OpenAPI JSON — no envelope wrapper.
 *
 * Uses @SpringBootTest (full context with H2) so springdoc's OpenApiWebMvcResource
 * is loaded and can serve the spec. @WebMvcTest(controller) slices don't include
 * springdoc's auto-configuration for single-controller slices.
 */
@SpringBootTest
@AutoConfigureMockMvc
class OpenApiEnvelopeExemptTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser
    void getApiDocs_returnsRawOpenApiJson_notWrappedInEnvelope() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                // Raw OpenAPI 3.x JSON has 'openapi' version field at root
                .andExpect(jsonPath("$.openapi").exists())
                // Our envelope shape must NOT be present at root
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.errors").doesNotExist());
    }
}
