package org.example.user;

import org.example.auth.JwtService;
import org.example.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** {@code GET /api/usuarios}: admin-only, paged, forwards tipo / activo / q to the service. */
@WebMvcTest(UsuarioController.class)
@Import(SecurityConfig.class)
class UsuarioControllerListarTest {

    private static final String PATH = "/api/usuarios";

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

    private static UsernamePasswordAuthenticationToken auth(String role) {
        return new UsernamePasswordAuthenticationToken(1L, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    @Test
    void anonymousIsRejected() throws Exception {
        mockMvc.perform(get(PATH)).andExpect(status().isForbidden());

        verify(usuarioService, never()).findAll(any(), any(), any(), any());
    }

    @Test
    void nonAdminIsForbidden() throws Exception {
        mockMvc.perform(get(PATH).with(authentication(auth("REFERENTE")))).andExpect(status().isForbidden());
        mockMvc.perform(get(PATH).with(authentication(auth("DONANTE")))).andExpect(status().isForbidden());

        verify(usuarioService, never()).findAll(any(), any(), any(), any());
    }

    @Test
    void adminGetsAPageAndFiltersAreForwarded() throws Exception {
        when(usuarioService.findAll(eq(TipoUsuario.REFERENTE), eq(true), eq("ana"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(
                        List.of(new UsuarioResponse(2L, "Ana", "ana@test.com", "REFERENTE", true)),
                        PageRequest.of(1, 5, Sort.by("id")), 11));

        mockMvc.perform(get(PATH).with(authentication(auth("ADMINISTRADOR")))
                        .param("tipo", "REFERENTE").param("activo", "true").param("q", "ana")
                        .param("page", "1").param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(11))
                .andExpect(jsonPath("$.data.totalPages").value(3))
                .andExpect(jsonPath("$.data.number").value(1))
                .andExpect(jsonPath("$.data.content.length()").value(1));
    }

    @Test
    void unknownTipoIsABadRequest() throws Exception {
        mockMvc.perform(get(PATH).with(authentication(auth("ADMINISTRADOR"))).param("tipo", "ROOT"))
                .andExpect(status().isBadRequest());

        verify(usuarioService, never()).findAll(any(), any(), any(), any());
    }
}
