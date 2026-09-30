package org.example.donacion.entrega;

import org.example.auth.JwtService;
import org.example.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AD-6/task 3a.6: {@code GET /api/donaciones/{id}/entrega} must NOT fall through to the existing
 * {@code permitAll} block for {@code GET /api/donaciones/**} (`SecurityConfig`). Same
 * {@code @Import(SecurityConfig.class)} pattern as {@code AcreditacionControllerSecurityTest} —
 * required so the real filter chain (not Boot's default auto-configured one) is exercised.
 */
@WebMvcTest(EntregaController.class)
@Import(SecurityConfig.class)
class EntregaControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private EntregaService entregaService;

    @MockBean
    private JwtService jwtService;

    @Test
    void anonymousGetEstado_isDenied() throws Exception {
        mockMvc.perform(get("/api/donaciones/1/entrega"))
                .andExpect(status().isForbidden());
    }
}
