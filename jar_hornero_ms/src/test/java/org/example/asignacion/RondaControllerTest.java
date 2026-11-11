package org.example.asignacion;

import org.example.asignacion.dto.RondaFondoResponse;
import org.example.asignacion.dto.RondaResponse;
import org.example.auth.JwtService;
import org.example.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AD-9, slice 5c-ii: {@code /api/rondas/**} is ADMINISTRADOR-only at every endpoint — triggering a
 * ronda is never available to REFERENTE/DONANTE/anonymous (spec `ronda-asignacion`, "Manual
 * ADMINISTRADOR Trigger Only").
 */
@WebMvcTest(RondaController.class)
@Import(SecurityConfig.class)
class RondaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RondaService rondaService;

    @MockBean
    private AsignacionService asignacionService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private org.example.user.UsuarioRepository usuarioRepository;

    private static UsernamePasswordAuthenticationToken auth(long userId, String role) {
        return new UsernamePasswordAuthenticationToken(userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    private RondaResponse sampleRonda() {
        return new RondaResponse(1L, Instant.now(), Instant.now(), 2L, "Ada Admin", "MANUAL", "COMPLETADA", null,
                1, 0, 0, 0, 0, 0, 0.0, null, null, null, null, null);
    }

    // --- POST /api/rondas ---

    @Test
    void postRonda_anonymous_isDenied() throws Exception {
        mockMvc.perform(post("/api/rondas"))
                .andExpect(status().isForbidden());
    }

    @Test
    void postRonda_referente_isForbidden() throws Exception {
        mockMvc.perform(post("/api/rondas").with(authentication(auth(5L, "REFERENTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void postRonda_donante_isForbidden() throws Exception {
        mockMvc.perform(post("/api/rondas").with(authentication(auth(9L, "DONANTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void postRonda_admin_succeeds() throws Exception {
        org.example.domain.Ronda ronda = new org.example.domain.Ronda();
        when(rondaService.ejecutar(anyLong())).thenReturn(ronda);
        when(rondaService.toResponse(ronda)).thenReturn(sampleRonda());

        mockMvc.perform(post("/api/rondas").with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isCreated());
    }

    // --- GET /api/rondas, /api/rondas/{id}, /api/rondas/fondo ---

    @Test
    void getRondas_anonymous_isDenied() throws Exception {
        mockMvc.perform(get("/api/rondas")).andExpect(status().isForbidden());
    }

    @Test
    void getRondas_referente_isForbidden() throws Exception {
        mockMvc.perform(get("/api/rondas").with(authentication(auth(5L, "REFERENTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void getRondas_admin_succeeds() throws Exception {
        when(rondaService.listar(any())).thenReturn(new PageImpl<>(List.of(sampleRonda()), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/rondas").with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isOk());
    }

    @Test
    void getRondaDetalle_donante_isForbidden() throws Exception {
        mockMvc.perform(get("/api/rondas/1").with(authentication(auth(9L, "DONANTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void getRondaDetalle_admin_succeeds() throws Exception {
        when(rondaService.detalle(1L)).thenReturn(sampleRonda());

        mockMvc.perform(get("/api/rondas/1").with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isOk());
    }

    @Test
    void getFondo_anonymous_isDenied() throws Exception {
        mockMvc.perform(get("/api/rondas/fondo")).andExpect(status().isForbidden());
    }

    @Test
    void getFondo_admin_succeeds() throws Exception {
        when(rondaService.fondoEstado()).thenReturn(new RondaFondoResponse(3, null));

        mockMvc.perform(get("/api/rondas/fondo").with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isOk());
    }

    // --- GET /api/rondas/{id}/asignaciones ---

    @Test
    void getAsignacionesDeRonda_anonymous_isDenied() throws Exception {
        mockMvc.perform(get("/api/rondas/1/asignaciones")).andExpect(status().isForbidden());
    }

    @Test
    void getAsignacionesDeRonda_referente_isForbidden() throws Exception {
        mockMvc.perform(get("/api/rondas/1/asignaciones").with(authentication(auth(5L, "REFERENTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void getAsignacionesDeRonda_donante_isForbidden() throws Exception {
        mockMvc.perform(get("/api/rondas/1/asignaciones").with(authentication(auth(9L, "DONANTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void getAsignacionesDeRonda_admin_succeeds() throws Exception {
        when(asignacionService.porRonda(1L)).thenReturn(List.of(
                new org.example.asignacion.dto.AsignacionRondaResponse(null, 7L, "Arroz x5", "Necesidad")));

        mockMvc.perform(get("/api/rondas/1/asignaciones").with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isOk());
    }

    @Test
    void getAsignacionesDeRonda_unknownRonda_is404() throws Exception {
        when(asignacionService.porRonda(99L)).thenThrow(
                new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Ronda not found"));

        mockMvc.perform(get("/api/rondas/99/asignaciones").with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isNotFound());
    }
}
