package org.example.user;

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

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** N15: only an ADMINISTRADOR may anonymize; the real matcher order is exercised via SecurityConfig. */
@WebMvcTest(UsuarioController.class)
@Import(SecurityConfig.class)
class UsuarioControllerSecurityTest {

    private static final String PATH = "/api/usuarios/7/anonimizar";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UsuarioService usuarioService;
    @MockBean
    private UsuarioAnonimizacionService anonimizacionService;
    @MockBean
    private JwtService jwtService;
    @MockBean
    private UsuarioRepository usuarioRepository;

    private static UsernamePasswordAuthenticationToken auth(long userId, String role) {
        return new UsernamePasswordAuthenticationToken(userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    @Test
    void anonymous_isForbidden() throws Exception {
        mockMvc.perform(post(PATH)).andExpect(status().isForbidden());
        verifyNoInteractions(anonimizacionService);
    }

    @Test
    void donante_isForbidden() throws Exception {
        mockMvc.perform(post(PATH).with(authentication(auth(2L, "DONANTE")))).andExpect(status().isForbidden());
        verifyNoInteractions(anonimizacionService);
    }

    @Test
    void referente_isForbidden() throws Exception {
        mockMvc.perform(post(PATH).with(authentication(auth(2L, "REFERENTE")))).andExpect(status().isForbidden());
        verifyNoInteractions(anonimizacionService);
    }

    @Test
    void admin_isOk_andPassesItsOwnIdAsActor() throws Exception {
        when(anonimizacionService.anonimizar(7L, 1L))
                .thenReturn(new UsuarioResponse(7L, "Usuario eliminado", "e@anonimo.invalid", "DONANTE", false));

        mockMvc.perform(post(PATH).with(authentication(auth(1L, "ADMINISTRADOR")))).andExpect(status().isOk());
    }
}
