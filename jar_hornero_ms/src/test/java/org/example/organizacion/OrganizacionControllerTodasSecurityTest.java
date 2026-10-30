package org.example.organizacion;

import org.example.auth.JwtService;
import org.example.config.SecurityConfig;
import org.example.organizacion.dto.OrganizacionResponse;
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

/** {@code GET /api/organizaciones/todas}: admin-only, paged, forwards its filters to the service. */
@WebMvcTest(OrganizacionController.class)
@Import({SecurityConfig.class, MapaOrganizacionesCache.class})
class OrganizacionControllerTodasSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrganizacionService organizacionService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private org.example.user.UsuarioRepository usuarioRepository;

    private static UsernamePasswordAuthenticationToken auth(String role) {
        return new UsernamePasswordAuthenticationToken(1L, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    @Test
    void anonymousIsRejected() throws Exception {
        mockMvc.perform(get("/api/organizaciones/todas")).andExpect(status().isForbidden());

        verify(organizacionService, never()).listarTodas(any(), any(), any(), any());
    }

    @Test
    void nonAdminIsForbidden() throws Exception {
        mockMvc.perform(get("/api/organizaciones/todas").with(authentication(auth("REFERENTE"))))
                .andExpect(status().isForbidden());

        verify(organizacionService, never()).listarTodas(any(), any(), any(), any());
    }

    @Test
    void adminGetsAPageAndFiltersAreForwarded() throws Exception {
        when(organizacionService.listarTodas(eq(true), eq(List.of(1L, 2L, 3L)), eq("sol"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(new OrganizacionResponse()), PageRequest.of(1, 5, Sort.by("id")), 11));

        mockMvc.perform(get("/api/organizaciones/todas").with(authentication(auth("ADMINISTRADOR")))
                        .param("sinReferente", "true").param("referenteIds", "1,2,3").param("q", "sol")
                        .param("page", "1").param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(11))
                .andExpect(jsonPath("$.data.totalPages").value(3))
                .andExpect(jsonPath("$.data.number").value(1))
                .andExpect(jsonPath("$.data.size").value(5))
                .andExpect(jsonPath("$.data.content.length()").value(1));
    }
}
