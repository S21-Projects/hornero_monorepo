package org.example.reporte;

import org.example.auth.JwtService;
import org.example.config.SecurityConfig;
import org.example.domain.EstadoReporte;
import org.example.domain.MotivoReporte;
import org.example.idempotencia.Idempotente;
import org.example.reporte.dto.OrganizacionCercanaResponse;
import org.example.reporte.dto.ReporteResponse;
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
 * Role matrix of the report endpoints against the real {@link SecurityConfig} chain: nothing is
 * world-readable, any authenticated user submits and queries nearby organizaciones, only
 * ADMINISTRADOR lists and resolves.
 */
@WebMvcTest(ReporteController.class)
@Import(SecurityConfig.class)
class ReporteControllerSecurityTest {

    private static final String BODY = """
            {"organizacionId":1,"motivo":"INACTIVO","detalle":"Cerró"}""";

    @Autowired private MockMvc mockMvc;
    @MockBean private ReporteService reporteService;
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
                    .content(path.endsWith("descartar") ? "{\"nota\":\"no\"}" : "{}");
            default -> throw new IllegalArgumentException(method);
        };
    }

    // method, path
    private static final String ANY_ROLE = """
            POST,/api/reportes
            GET,/api/reportes/cercanas?organizacionId=1
            """;
    private static final String ADMIN_ONLY = """
            GET,/api/reportes/pendientes
            GET,/api/reportes/5
            PATCH,/api/reportes/5/marcar-inactiva
            PATCH,/api/reportes/5/descartar
            """;

    @ParameterizedTest
    @CsvSource(textBlock = ANY_ROLE + ADMIN_ONLY)
    void anonymousIsDenied(String method, String path) throws Exception {
        mockMvc.perform(request(method, path)).andExpect(status().isForbidden());
        verifyNoInteractions(reporteService);
    }

    @ParameterizedTest
    @CsvSource(textBlock = ADMIN_ONLY)
    void nonAdminsAreDeniedOnResolution(String method, String path) throws Exception {
        for (String role : List.of("REFERENTE", "DONANTE")) {
            mockMvc.perform(request(method, path).with(authentication(auth(9, role))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(reporteService);
    }

    @Test
    void everyRoleSubmitsWithTheirOwnIdFromTheToken() throws Exception {
        when(reporteService.crear(any(), anyLong())).thenReturn(respuesta());

        for (String role : List.of("ADMINISTRADOR", "REFERENTE", "DONANTE")) {
            mockMvc.perform(post("/api/reportes").contentType(MediaType.APPLICATION_JSON).content(BODY)
                            .with(authentication(auth(7, role))))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.data.estado").value("PENDIENTE"));
        }
        verify(reporteService, org.mockito.Mockito.times(3)).crear(any(), eq(7L));
    }

    @Test
    void everyRoleCanQueryNearby() throws Exception {
        when(reporteService.cercanas(1L)).thenReturn(List.of(new OrganizacionCercanaResponse(2L, "comedor-2", "Comedor 2", "Calle 2", 120)));

        mockMvc.perform(get("/api/reportes/cercanas?organizacionId=1").with(authentication(auth(7, "DONANTE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].slug").value("comedor-2"))
                .andExpect(jsonPath("$.data[0].distanciaMetros").value(120));
    }

    @Test
    void createRejectsAnInvalidBody() throws Exception {
        for (String bad : List.of(
                "{\"motivo\":\"INACTIVO\"}",
                "{\"organizacionId\":1}",
                "{\"organizacionId\":1,\"motivo\":\"OTRO\",\"detalle\":\"" + "x".repeat(1001) + "\"}")) {
            mockMvc.perform(post("/api/reportes").contentType(MediaType.APPLICATION_JSON).content(bad)
                            .with(authentication(auth(7, "DONANTE"))))
                    .andExpect(status().isBadRequest());
        }
        verify(reporteService, never()).crear(any(), anyLong());
    }

    @Test
    void discardRequiresANote() throws Exception {
        for (String bad : List.of("{}", "{\"nota\":\"  \"}")) {
            mockMvc.perform(patch("/api/reportes/5/descartar").contentType(MediaType.APPLICATION_JSON).content(bad)
                            .with(authentication(auth(1, "ADMINISTRADOR"))))
                    .andExpect(status().isBadRequest());
        }
        verify(reporteService, never()).descartar(anyLong(), any(), anyLong());
    }

    @Test
    void adminResolvesAndLists() throws Exception {
        when(reporteService.marcarInactiva(5L, 1L)).thenReturn(respuesta());
        when(reporteService.descartar(5L, "no", 1L)).thenReturn(respuesta());
        when(reporteService.detalle(5L)).thenReturn(respuesta());
        when(reporteService.listarPendientes(any())).thenReturn(new PageImpl<>(List.of(respuesta())));
        var admin = authentication(auth(1, "ADMINISTRADOR"));

        mockMvc.perform(patch("/api/reportes/5/marcar-inactiva").with(admin)).andExpect(status().isOk());
        mockMvc.perform(patch("/api/reportes/5/descartar").contentType(MediaType.APPLICATION_JSON)
                .content("{\"nota\":\"no\"}").with(admin)).andExpect(status().isOk());
        mockMvc.perform(get("/api/reportes/5").with(admin)).andExpect(status().isOk());
        mockMvc.perform(get("/api/reportes/pendientes").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(5));
    }

    @Test
    void creationRequiresAnIdempotencyKey() throws Exception {
        var method = ReporteController.class.getMethod("crear", org.example.reporte.dto.CrearReporteRequest.class);
        assertThat(method.isAnnotationPresent(Idempotente.class)).isTrue();
    }

    private static ReporteResponse respuesta() {
        return new ReporteResponse(5L, 1L, "Comedor", "comedor", "Calle 1", 7L, "Dona", "dona@test.com",
                MotivoReporte.INACTIVO, null, null, null, "Cerró", EstadoReporte.PENDIENTE, null, null,
                java.time.Instant.now(), null);
    }
}
