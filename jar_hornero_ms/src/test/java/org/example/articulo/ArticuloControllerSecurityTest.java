package org.example.articulo;

import org.example.articulo.dto.ActualizarArticuloRequest;
import org.example.articulo.dto.CrearArticuloRequest;
import org.example.auth.JwtService;
import org.example.config.SecurityConfig;
import org.example.domain.CategoriaAlimento;
import org.example.domain.UnidadArticulo;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * C2/C3 (feature catalogo-articulos): public GET, ADMINISTRADOR-only writes. {@code @Import
 * (SecurityConfig.class)} is required so the real matcher order is exercised, not
 * {@code @WebMvcTest}'s default security auto-configuration — same convention as
 * {@code AcreditacionControllerSecurityTest}/{@code EntregaControllerSecurityTest}.
 */
@WebMvcTest(ArticuloController.class)
@Import(SecurityConfig.class)
class ArticuloControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ArticuloService articuloService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private org.example.user.UsuarioRepository usuarioRepository;

    private static UsernamePasswordAuthenticationToken auth(long userId, String role) {
        return new UsernamePasswordAuthenticationToken(userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    private ArticuloResponse sample() {
        return new ArticuloResponse(1L, "Arroz", CategoriaAlimento.NO_PERECEDERO.name(), UnidadArticulo.KG.name(), true);
    }

    @Test
    void get_anonymous_isOk() throws Exception {
        when(articuloService.listar(false)).thenReturn(List.of(sample()));

        mockMvc.perform(get("/api/articulos"))
                .andExpect(status().isOk());
    }

    @Test
    void post_anonymous_isForbidden() throws Exception {
        mockMvc.perform(post("/api/articulos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Arroz\",\"categoria\":\"NO_PERECEDERO\",\"unidad\":\"KG\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void post_referente_isForbidden() throws Exception {
        mockMvc.perform(post("/api/articulos")
                        .with(authentication(auth(1L, "REFERENTE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Arroz\",\"categoria\":\"NO_PERECEDERO\",\"unidad\":\"KG\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void post_donante_isForbidden() throws Exception {
        mockMvc.perform(post("/api/articulos")
                        .with(authentication(auth(1L, "DONANTE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Arroz\",\"categoria\":\"NO_PERECEDERO\",\"unidad\":\"KG\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void post_administrador_isCreated() throws Exception {
        when(articuloService.crear(org.mockito.ArgumentMatchers.any(CrearArticuloRequest.class)))
                .thenReturn(sample());

        mockMvc.perform(post("/api/articulos")
                        .with(authentication(auth(1L, "ADMINISTRADOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Arroz\",\"categoria\":\"NO_PERECEDERO\",\"unidad\":\"KG\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void put_anonymous_isForbidden() throws Exception {
        mockMvc.perform(put("/api/articulos/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Arroz\",\"categoria\":\"NO_PERECEDERO\",\"unidad\":\"KG\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void put_administrador_isOk() throws Exception {
        when(articuloService.actualizar(org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.any(ActualizarArticuloRequest.class)))
                .thenReturn(sample());

        mockMvc.perform(put("/api/articulos/1")
                        .with(authentication(auth(1L, "ADMINISTRADOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Arroz\",\"categoria\":\"NO_PERECEDERO\",\"unidad\":\"KG\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void patchDesactivar_anonymous_isForbidden() throws Exception {
        mockMvc.perform(patch("/api/articulos/1/desactivar"))
                .andExpect(status().isForbidden());
    }

    @Test
    void patchDesactivar_administrador_isOk() throws Exception {
        mockMvc.perform(patch("/api/articulos/1/desactivar")
                        .with(authentication(auth(1L, "ADMINISTRADOR"))))
                .andExpect(status().isOk());
    }

    @Test
    void patchReactivar_anonymous_isForbidden() throws Exception {
        mockMvc.perform(patch("/api/articulos/1/reactivar"))
                .andExpect(status().isForbidden());
    }

    @Test
    void patchReactivar_referente_isForbidden() throws Exception {
        mockMvc.perform(patch("/api/articulos/1/reactivar")
                        .with(authentication(auth(1L, "REFERENTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void patchReactivar_administrador_isOk() throws Exception {
        mockMvc.perform(patch("/api/articulos/1/reactivar")
                        .with(authentication(auth(1L, "ADMINISTRADOR"))))
                .andExpect(status().isOk());
    }

    @Test
    void getAdmin_anonymous_isForbidden() throws Exception {
        mockMvc.perform(get("/api/articulos/admin"))
                .andExpect(status().isForbidden());
    }

    @Test
    void getAdmin_donante_isForbidden() throws Exception {
        mockMvc.perform(get("/api/articulos/admin")
                        .with(authentication(auth(1L, "DONANTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void getAdmin_administrador_isOkAndForwardsFilters() throws Exception {
        when(articuloService.listarAdmin(org.mockito.ArgumentMatchers.eq(true),
                org.mockito.ArgumentMatchers.eq(CategoriaAlimento.REFRIGERADO),
                org.mockito.ArgumentMatchers.eq("leche"), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(sample())));

        mockMvc.perform(get("/api/articulos/admin")
                        .param("incluirInactivos", "true")
                        .param("categoria", "REFRIGERADO")
                        .param("q", "leche")
                        .param("page", "0")
                        .param("size", "10")
                        .with(authentication(auth(1L, "ADMINISTRADOR"))))
                .andExpect(status().isOk());
    }
}
