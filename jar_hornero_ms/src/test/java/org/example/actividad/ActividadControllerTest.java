package org.example.actividad;

import org.example.auth.JwtService;
import org.example.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** ASVS 16.4.2: the log is readable by ADMINISTRADOR only and has no write endpoints. */
@WebMvcTest(ActividadController.class)
@Import(SecurityConfig.class)
class ActividadControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ActividadService actividadService;

    @MockBean
    private ActorResolver actorResolver;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private org.example.user.UsuarioRepository usuarioRepository;

    private static UsernamePasswordAuthenticationToken auth(long userId, String role) {
        return new UsernamePasswordAuthenticationToken(userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    @Test
    void anonymous_isDenied() throws Exception {
        mockMvc.perform(get("/api/actividad")).andExpect(status().isForbidden());
    }

    @Test
    void donante_isForbidden() throws Exception {
        mockMvc.perform(get("/api/actividad").with(authentication(auth(9L, "DONANTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void referente_isForbidden() throws Exception {
        mockMvc.perform(get("/api/actividad").with(authentication(auth(5L, "REFERENTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void admin_listsAndFiltersAreForwarded() throws Exception {
        when(actividadService.buscar(any(), any())).thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        mockMvc.perform(get("/api/actividad")
                        .param("accion", "LOGIN").param("resultado", "FALLO").param("actorUsuarioId", "3")
                        .param("entidadTipo", "USUARIO").param("entidadId", "7")
                        .param("desde", Instant.parse("2026-10-01T00:00:00Z").toString())
                        .with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0));

        org.mockito.ArgumentCaptor<ActividadService.Filtro> captor = org.mockito.ArgumentCaptor.forClass(ActividadService.Filtro.class);
        verify(actividadService).buscar(captor.capture(), any());
        org.assertj.core.api.Assertions.assertThat(captor.getValue().accion()).isEqualTo(TipoActividad.LOGIN);
        org.assertj.core.api.Assertions.assertThat(captor.getValue().resultado()).isEqualTo(ResultadoActividad.FALLO);
        org.assertj.core.api.Assertions.assertThat(captor.getValue().actorUsuarioId()).isEqualTo(3L);
    }

    @Test
    void admin_listing_includesResolvedActorNameAndEmail_forUserRowsOnly() throws Exception {
        Actividad conActor = new Actividad(Instant.parse("2026-10-01T00:00:00Z"), 7L, TipoActor.ADMINISTRADOR,
                TipoActividad.LOGIN, ResultadoActividad.EXITO, null, null, null, null, null, null, null, null);
        Actividad sistema = new Actividad(Instant.parse("2026-10-01T00:00:00Z"), null, TipoActor.SISTEMA,
                TipoActividad.ACTIVIDAD_PURGADA, ResultadoActividad.EXITO, null, null, null, null, null, null, null, null);
        when(actividadService.buscar(any(), any())).thenReturn(new PageImpl<>(List.of(conActor, sistema), PageRequest.of(0, 20), 2));
        when(actorResolver.resolver(any())).thenReturn(java.util.Map.of(7L, new ActorResolver.Actor("Ada Admin", "ada@test.com")));

        mockMvc.perform(get("/api/actividad").with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].actorNombre").value("Ada Admin"))
                .andExpect(jsonPath("$.data.content[0].actorEmail").value("ada@test.com"))
                .andExpect(jsonPath("$.data.content[1].actorNombre").doesNotExist());
        verify(actorResolver, org.mockito.Mockito.times(1)).resolver(any());
    }

    @Test
    void thereAreNoWriteEndpoints_evenForAdmin() throws Exception {
        var admin = authentication(auth(2L, "ADMINISTRADOR"));
        for (var request : List.of(post("/api/actividad"), patch("/api/actividad/1"), delete("/api/actividad/1"))) {
            int code = mockMvc.perform(request.with(admin)).andReturn().getResponse().getStatus();
            org.assertj.core.api.Assertions.assertThat(code).isGreaterThanOrEqualTo(400);
        }
        org.mockito.Mockito.verifyNoInteractions(actividadService);
    }
}
