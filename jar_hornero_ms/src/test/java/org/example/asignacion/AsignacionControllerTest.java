package org.example.asignacion;

import org.example.auth.JwtService;
import org.example.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AD-9, spec `ronda-asignacion`: {@code GET /api/donaciones/{id}/asignaciones} is accessible to the
 * owning donante, any referente involved in the donación's assignment history, and admin — denied
 * to unrelated actors and anonymous.
 */
@WebMvcTest(AsignacionController.class)
@Import(SecurityConfig.class)
class AsignacionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AsignacionService asignacionService;

    @MockBean
    private JwtService jwtService;

    private static UsernamePasswordAuthenticationToken auth(long userId, String role) {
        return new UsernamePasswordAuthenticationToken(userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    @Test
    void anonymous_isDenied() throws Exception {
        mockMvc.perform(get("/api/donaciones/1/asignaciones"))
                .andExpect(status().isForbidden());
    }

    @Test
    void owningDonante_succeeds() throws Exception {
        when(asignacionService.historial(eq(1L), eq(7L), eq(false))).thenReturn(List.of());

        mockMvc.perform(get("/api/donaciones/1/asignaciones").with(authentication(auth(7L, "DONANTE"))))
                .andExpect(status().isOk());
    }

    @Test
    void involvedReferente_succeeds() throws Exception {
        when(asignacionService.historial(eq(1L), eq(3L), eq(false))).thenReturn(List.of());

        mockMvc.perform(get("/api/donaciones/1/asignaciones").with(authentication(auth(3L, "REFERENTE"))))
                .andExpect(status().isOk());
    }

    @Test
    void admin_succeeds() throws Exception {
        when(asignacionService.historial(eq(1L), eq(2L), eq(true))).thenReturn(List.of());

        mockMvc.perform(get("/api/donaciones/1/asignaciones").with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isOk());
    }

    @Test
    void unrelatedActor_isForbidden() throws Exception {
        when(asignacionService.historial(anyLong(), anyLong(), anyBoolean()))
                .thenThrow(new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.FORBIDDEN, "Access denied"));

        mockMvc.perform(get("/api/donaciones/1/asignaciones").with(authentication(auth(99L, "REFERENTE"))))
                .andExpect(status().isForbidden());
    }
}
