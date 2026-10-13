package org.example.reclamo;

import org.example.auth.JwtService;
import org.example.config.SecurityConfig;
import org.example.idempotencia.Idempotente;
import org.example.reclamo.dto.ReclamoResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Role matrix of the claim endpoints against the real {@link SecurityConfig} chain: nothing is
 * world-readable, REFERENTE submits and reads their own, only ADMINISTRADOR resolves.
 */
@WebMvcTest(ReclamoController.class)
@Import(SecurityConfig.class)
class ReclamoControllerSecurityTest {

    private static final String BODY = """
            {"organizacionId":1,"rol":"RESPONSABLE","telefono":"351 555 1234","mensaje":"hola",
             "evidenciaKeys":["reclamo-evidencia/1/7/1.jpg"]}""";

    @Autowired private MockMvc mockMvc;
    @MockBean private ReclamoService reclamoService;
    @MockBean private JwtService jwtService;
    @MockBean private org.example.user.UsuarioRepository usuarioRepository;

    private static UsernamePasswordAuthenticationToken auth(long userId, String role) {
        return new UsernamePasswordAuthenticationToken(userId, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    private MockHttpServletRequestBuilder request(String method, String path) {
        return switch (method) {
            case "GET" -> get(path);
            case "POST" -> post(path).contentType(MediaType.APPLICATION_JSON).content(BODY);
            case "PATCH" -> patch(path).contentType(MediaType.APPLICATION_JSON)
                    .content(path.endsWith("rechazar") ? "{\"motivo\":\"no\"}" : "{}");
            default -> throw new IllegalArgumentException(method);
        };
    }

    // method, path, allowed role
    private static final String MATRIX = """
            POST,/api/reclamos,REFERENTE
            GET,/api/reclamos/mios,REFERENTE
            GET,/api/reclamos/pendientes,ADMINISTRADOR
            GET,/api/reclamos/disponibilidad?organizacionId=1,REFERENTE
            PATCH,/api/reclamos/5/aprobar,ADMINISTRADOR
            PATCH,/api/reclamos/5/rechazar,ADMINISTRADOR
            """;

    @ParameterizedTest
    @CsvSource(textBlock = MATRIX)
    void anonymousIsDenied(String method, String path, String role) throws Exception {
        mockMvc.perform(request(method, path)).andExpect(status().isForbidden());
        verifyNoInteractions(reclamoService);
    }

    @ParameterizedTest
    @CsvSource(textBlock = MATRIX)
    void everyOtherRoleIsDenied(String method, String path, String allowed) throws Exception {
        for (String other : List.of("ADMINISTRADOR", "REFERENTE", "DONANTE")) {
            if (other.equals(allowed)) continue;
            mockMvc.perform(request(method, path).with(authentication(auth(9, other))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(reclamoService);
    }

    @Test
    void detailAndFileAreForAdminOrReferenteOnly() throws Exception {
        mockMvc.perform(get("/api/reclamos/5")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/reclamos/5").with(authentication(auth(9, "DONANTE"))))
                .andExpect(status().isForbidden());
        String file = "/api/reclamos/archivo?organizacionId=1&solicitanteId=7&objectKey=reclamo-evidencia/1/7/1.jpg";
        mockMvc.perform(get(file)).andExpect(status().isForbidden());
        mockMvc.perform(get(file).with(authentication(auth(9, "DONANTE")))).andExpect(status().isForbidden());
        verifyNoInteractions(reclamoService);
    }

    @Test
    void referenteCreates_withTheirOwnIdFromTheToken() throws Exception {
        when(reclamoService.crear(any(), eq(7L))).thenReturn(respuesta());

        mockMvc.perform(post("/api/reclamos").contentType(MediaType.APPLICATION_JSON).content(BODY)
                        .with(authentication(auth(7, "REFERENTE"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.estado").value("PENDIENTE"));
        verify(reclamoService).crear(any(), eq(7L));
    }

    @Test
    void createRejectsAnInvalidBody() throws Exception {
        for (String bad : List.of(
                "{\"organizacionId\":1,\"rol\":\"RESPONSABLE\",\"telefono\":\"351 555 1234\",\"evidenciaKeys\":[]}",
                "{\"organizacionId\":1,\"rol\":\"RESPONSABLE\",\"telefono\":\"abc\",\"evidenciaKeys\":[\"k\"]}",
                "{\"rol\":\"RESPONSABLE\",\"telefono\":\"351 555 1234\",\"evidenciaKeys\":[\"k\"]}",
                "{\"organizacionId\":1,\"rol\":\"VOLUNTARIO\",\"telefono\":\"351 555 1234\",\"evidenciaKeys\":[\"a\",\"b\",\"c\",\"d\"]}")) {
            mockMvc.perform(post("/api/reclamos").contentType(MediaType.APPLICATION_JSON).content(bad)
                            .with(authentication(auth(7, "REFERENTE"))))
                    .andExpect(status().isBadRequest());
        }
        verify(reclamoService, never()).crear(any(), anyLong());
    }

    @Test
    void rejectRequiresAMotivo() throws Exception {
        for (String bad : List.of("{}", "{\"motivo\":\"  \"}")) {
            mockMvc.perform(patch("/api/reclamos/5/rechazar").contentType(MediaType.APPLICATION_JSON).content(bad)
                            .with(authentication(auth(1, "ADMINISTRADOR"))))
                    .andExpect(status().isBadRequest());
        }
        verify(reclamoService, never()).rechazar(anyLong(), any(), anyLong());
    }

    @Test
    void adminResolves() throws Exception {
        when(reclamoService.aprobar(5L, 1L)).thenReturn(respuesta());
        when(reclamoService.rechazar(5L, "no", 1L)).thenReturn(respuesta());
        when(reclamoService.listarPendientes(any())).thenReturn(new PageImpl<>(List.of(respuesta())));

        mockMvc.perform(patch("/api/reclamos/5/aprobar").with(authentication(auth(1, "ADMINISTRADOR"))))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/reclamos/5/rechazar").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivo\":\"no\"}").with(authentication(auth(1, "ADMINISTRADOR"))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/reclamos/pendientes").with(authentication(auth(1, "ADMINISTRADOR"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(5));
    }

    @Test
    void detailPassesTheCallerAndRole() throws Exception {
        when(reclamoService.detalle(anyLong(), anyLong(), anyBoolean())).thenReturn(respuesta());

        mockMvc.perform(get("/api/reclamos/5").with(authentication(auth(7, "REFERENTE")))).andExpect(status().isOk());
        mockMvc.perform(get("/api/reclamos/5").with(authentication(auth(1, "ADMINISTRADOR")))).andExpect(status().isOk());

        verify(reclamoService).detalle(5L, 7L, false);
        verify(reclamoService).detalle(5L, 1L, true);
    }

    @Test
    void creationRequiresAnIdempotencyKey() throws Exception {
        var method = ReclamoController.class.getMethod("crear", org.example.reclamo.dto.CrearReclamoRequest.class);
        assertThat(method.isAnnotationPresent(Idempotente.class)).isTrue();
    }

    private static ReclamoResponse respuesta() {
        return new ReclamoResponse(5L, 1L, "Comedor", "comedor", "Calle 1", 7L, "Ana", "ana@test.com",
                org.example.domain.RolReclamo.RESPONSABLE, "351 555 1234", null, List.of("reclamo-evidencia/1/7/1.jpg"),
                org.example.domain.EstadoReclamo.PENDIENTE, null, null, java.time.Instant.now(), null, null, null);
    }
}
