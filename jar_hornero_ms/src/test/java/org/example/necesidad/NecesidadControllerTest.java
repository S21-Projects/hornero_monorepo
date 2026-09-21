package org.example.necesidad;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.auth.JwtService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * WebMvcTest for NecesidadController.
 * Covers T-MS-17, T-MS-18, T-MS-19, T-MS-20.
 *
 * Security notes:
 * - JwtService is mocked so JwtAuthFilter can be instantiated.
 * - @WithMockUser is used to satisfy Spring Security's auth requirement in the test slice.
 * - POST tests include csrf() since Spring Security test slice may enable CSRF by default.
 */
@WebMvcTest(NecesidadController.class)
class NecesidadControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private NecesidadService necesidadService;

    /**
     * JwtAuthFilter is a @Component Filter; it needs JwtService to be in the context.
     * Mocking it satisfies the dependency without running real JWT validation.
     */
    @MockBean
    private JwtService jwtService;

    // ------------------------------------------------------------------
    // T-MS-17: pagination params bind correctly; response has full envelope
    // ------------------------------------------------------------------

    @Test
    @WithMockUser
    void listar_withPaginationParams_returnsPagedEnvelope() throws Exception {
        var pageable = PageRequest.of(1, 5);
        var content = List.of(
                new NecesidadResponse(1L, "Desc 1", "ALTA", "ABIERTA", null, null, 1L, null),
                new NecesidadResponse(2L, "Desc 2", "MEDIA", "ABIERTA", null, null, 1L, null)
        );
        // Keep offset+pageSize <= total to avoid PageImpl normalisation: offset=5, size=5 <= 10
        var page = new PageImpl<>(content, pageable, 10L);

        when(necesidadService.findAll(any(Pageable.class))).thenReturn(page);

        mockMvc.perform(get("/api/necesidades")
                        .param("page", "1")
                        .param("size", "5")
                        .param("sort", "id,desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").exists())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.data.content").isArray())
                .andExpect(jsonPath("$.data.number").value(1))
                .andExpect(jsonPath("$.data.size").value(5))
                .andExpect(jsonPath("$.data.totalElements").value(10))
                .andExpect(jsonPath("$.data.totalPages").value(2));
    }

    // ------------------------------------------------------------------
    // T-MS-18: size=9999 is clamped to max-page-size=100
    // ------------------------------------------------------------------

    @Test
    @WithMockUser
    void listar_withOversizedPageSize_clampsTo100() throws Exception {
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        var clampedPage = PageRequest.of(0, 100);
        var page = new PageImpl<NecesidadResponse>(List.of(), clampedPage, 0L);

        when(necesidadService.findAll(captor.capture())).thenReturn(page);

        mockMvc.perform(get("/api/necesidades").param("size", "9999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.size").value(100));

        // verify Spring clamped the size before passing to the service
        assertThat(captor.getValue().getPageSize()).isEqualTo(100);
    }

    // ------------------------------------------------------------------
    // T-MS-19: GET nonexistent → HTTP 404 with error envelope
    // ------------------------------------------------------------------

    @Test
    @WithMockUser
    void findById_notFound_returns404Envelope() throws Exception {
        when(necesidadService.findById(9999L))
                .thenThrow(new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Necesidad not found"));

        mockMvc.perform(get("/api/necesidades/9999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.errors").isArray())
                .andExpect(jsonPath("$.errors").isNotEmpty());
    }

    // ------------------------------------------------------------------
    // T-MS-20: POST invalid body → HTTP 400 with field-level errors[]
    // Validation runs during argument resolution, before @PreAuthorize.
    // ------------------------------------------------------------------

    @Test
    @WithMockUser(roles = "REFERENTE")
    void crear_invalidBody_returns400WithFieldErrors() throws Exception {
        // {} is missing required fields: descripcion (@NotBlank), prioridad (@NotNull)
        mockMvc.perform(post("/api/necesidades")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errors").isArray())
                .andExpect(jsonPath("$.errors").isNotEmpty());
    }
}
