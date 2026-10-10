package org.example.config;

import org.example.articulo.ArticuloController;
import org.example.articulo.ArticuloService;
import org.example.auth.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** S9: the H2 console (test-scope dependency only) must never be a public route. */
@WebMvcTest(ArticuloController.class)
@Import(SecurityConfig.class)
class SecurityConfigH2ConsoleTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ArticuloService articuloService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private org.example.user.UsuarioRepository usuarioRepository;

    @Test
    void h2Console_anonymous_isForbidden() throws Exception {
        mockMvc.perform(get("/h2-console/")).andExpect(status().isForbidden());
    }
}
