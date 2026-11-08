package org.example.auditoria;

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

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuditoriaCadenaController.class)
@Import(SecurityConfig.class)
class AuditoriaCadenaControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockBean private AuditoriaCadenaServicio servicio;
    @MockBean private JwtService jwtService;
    @MockBean private org.example.user.UsuarioRepository usuarioRepository;

    private static UsernamePasswordAuthenticationToken auth(String role) {
        return new UsernamePasswordAuthenticationToken(1L, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    @Test
    void anonymousAndNonAdministratorsAreDenied() throws Exception {
        mockMvc.perform(get("/api/auditoria/cadena")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/auditoria/cadena").with(authentication(auth("REFERENTE")))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/auditoria/cadena").with(authentication(auth("DONANTE")))).andExpect(status().isForbidden());
        verify(servicio, never()).verificarSolicitada();
    }

    @Test
    void anAdministratorGetsTheVerificationResult() throws Exception {
        when(servicio.verificarSolicitada()).thenReturn(new VerificadorCadena.Resultado(
                false, 10, 2, 0, 7L, "ENLACE", 1, 9L, "ab".repeat(32), "cd".repeat(32)));

        mockMvc.perform(get("/api/auditoria/cadena").with(authentication(auth("ADMINISTRADOR"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.integra").value(false))
                .andExpect(jsonPath("$.data.primerIdRoto").value(7))
                .andExpect(jsonPath("$.data.motivo").value("ENLACE"))
                .andExpect(jsonPath("$.data.eventos").value(10));
    }
}
