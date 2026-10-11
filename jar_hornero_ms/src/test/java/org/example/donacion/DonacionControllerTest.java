package org.example.donacion;

import org.example.auth.JwtService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * WebMvcTest for DonacionController.
 *
 * Verifies:
 * - T-4a: response JSON includes necesidadDescripcion and organizacionNombre
 * - T-4b: default sort on GET /api/donaciones is fechaOferta DESC (no sort param)
 * - T-4c: default sort on GET /api/donaciones/mias is fechaOferta DESC (no sort param)
 *
 * Security: JwtService is mocked; @WithMockUser supplies auth context.
 */
@WebMvcTest(DonacionController.class)
class DonacionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DonacionService donacionService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private org.example.user.UsuarioRepository usuarioRepository;

    // ─── helpers ──────────────────────────────────────────────────────────────

    private DonacionResponse buildResponse(Long id, String descripcion, String orgNombre) {
        return new DonacionResponse(
                id,
                LocalDate.of(2024, 1, id.intValue()),
                null,
                "OFRECIDA",
                null,
                "Donante Test",
                10L,
                20L,
                descripcion,
                orgNombre,
                30L,
                null,
                null,
                "DIRECTA",
                null,
                "OFRECIDA",
                List.of()
        );
    }

    // ─── T-4a: enriched fields present in response JSON ───────────────────────

    @Test
    @WithMockUser
    void getAll_responseIncludesNecesidadDescripcionAndOrganizacionNombre() throws Exception {
        var item = buildResponse(1L, "Alimentos para familias", "Caritas");
        var page = new PageImpl<>(List.of(item), PageRequest.of(0, 20), 1L);
        when(donacionService.findAll(any(Pageable.class))).thenReturn(page);

        mockMvc.perform(get("/api/donaciones"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].necesidadDescripcion").value("Alimentos para familias"))
                .andExpect(jsonPath("$.data.content[0].organizacionNombre").value("Caritas"));
    }

    @Test
    @WithMockUser
    void getAll_nullDescripcion_coercedToEmptyString() throws Exception {
        var item = buildResponse(1L, "", "Org Test");
        var page = new PageImpl<>(List.of(item), PageRequest.of(0, 20), 1L);
        when(donacionService.findAll(any(Pageable.class))).thenReturn(page);

        mockMvc.perform(get("/api/donaciones"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].necesidadDescripcion").value(""));
    }

    // ─── T-4b: default sort on GET /api/donaciones ────────────────────────────

    @Test
    @WithMockUser
    void getAll_noSortParam_defaultSortIsFechaOfertaDesc() throws Exception {
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        var emptyPage = new PageImpl<DonacionResponse>(List.of());
        when(donacionService.findAll(captor.capture())).thenReturn(emptyPage);

        mockMvc.perform(get("/api/donaciones"))
                .andExpect(status().isOk());

        Sort sort = captor.getValue().getSort();
        assertThat(sort.isSorted()).isTrue();
        Sort.Order fechaOfertaOrder = sort.getOrderFor("fechaOferta");
        assertThat(fechaOfertaOrder).isNotNull();
        assertThat(fechaOfertaOrder.getDirection()).isEqualTo(Sort.Direction.DESC);
    }

    // ─── T-4c: default sort on GET /api/donaciones/mias ──────────────────────

    @Test
    void getMias_noSortParam_defaultSortIsFechaOfertaDesc() throws Exception {
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        var emptyPage = new PageImpl<DonacionResponse>(List.of());
        when(donacionService.findMias(any(Long.class), captor.capture())).thenReturn(emptyPage);

        var donanteAuth = new UsernamePasswordAuthenticationToken(
                42L, null, List.of(new SimpleGrantedAuthority("ROLE_DONANTE")));

        mockMvc.perform(get("/api/donaciones/mias")
                        .with(authentication(donanteAuth)))
                .andExpect(status().isOk());

        Sort sort = captor.getValue().getSort();
        assertThat(sort.isSorted()).isTrue();
        Sort.Order fechaOfertaOrder = sort.getOrderFor("fechaOferta");
        assertThat(fechaOfertaOrder).isNotNull();
        assertThat(fechaOfertaOrder.getDirection()).isEqualTo(Sort.Direction.DESC);
    }

    // ─── GET /activas: admin-only paginated active-donations list ────────────

    @Test
    void getActivas_anonymous_isUnauthorized() throws Exception {
        mockMvc.perform(get("/api/donaciones/activas"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "ADMINISTRADOR")
    void getActivas_sizeAboveMaxPageSize_clampsTo100() throws Exception {
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        var emptyPage = new PageImpl<org.example.donacion.DonacionActivaResponse>(List.of());
        when(donacionService.findActivas(any(), any(), captor.capture())).thenReturn(emptyPage);

        mockMvc.perform(get("/api/donaciones/activas").param("size", "9999"))
                .andExpect(status().isOk());

        assertThat(captor.getValue().getPageSize()).isEqualTo(100);
    }

    // ─── Retirement: the plain confirm-entrega endpoint no longer exists ─────
    // Spec `donacion-entrega-codigo` — "Old confirm endpoint no longer exists": no code path
    // resolves the retired handler; the code-verified path (EntregaController) is the only route
    // to ENTREGADA besides the admin override.

    @Test
    @WithMockUser
    void confirmarEntrega_retiredRoute_returns404() throws Exception {
        mockMvc.perform(post("/api/donaciones/1/confirmar-entrega").with(csrf()))
                .andExpect(status().isNotFound());
    }
}
