package org.example.organizacion;

import org.example.auth.JwtService;
import org.example.config.SecurityConfig;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.OrigenOrganizacion;
import org.example.domain.TipoOrganizacion;
import org.example.organizacion.dto.OrganizacionMapaResponse;
import org.example.organizacion.dto.OrganizacionMapaZonaResponse;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The map endpoint is public and must not be swallowed by the {@code /{slug}} route. */
@WebMvcTest(OrganizacionController.class)
@Import({SecurityConfig.class, MapaOrganizacionesCache.class})
class OrganizacionControllerMapaSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrganizacionService organizacionService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private org.example.user.UsuarioRepository usuarioRepository;

    @Test
    void anonymousCanReadMapaAndItRoutesToMapaNotSlug() throws Exception {
        when(organizacionService.listarMapa()).thenReturn(List.of(new OrganizacionMapaResponse(
                1L, "comedor-x-1", "Comedor X", TipoOrganizacion.COMEDOR, EstadoOrganizacion.SIN_RECLAMAR,
                OrigenOrganizacion.RENACOM, -34.6, -58.4, 2L)));

        mockMvc.perform(get("/api/organizaciones/mapa"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Cache-Control", "max-age=300, public"))
                .andExpect(jsonPath("$.data[0].slug").value("comedor-x-1"))
                .andExpect(jsonPath("$.data[0].estado").value("SIN_RECLAMAR"))
                .andExpect(jsonPath("$.data[0].origen").value("RENACOM"))
                .andExpect(jsonPath("$.data[0].latitud").value(-34.6))
                .andExpect(jsonPath("$.data[0].necesidadesAbiertas").value(2));

        verify(organizacionService).listarMapa();
    }

    @Test
    void anonymousCanReadMapaZonaWithShortCache() throws Exception {
        when(organizacionService.listarMapaZona(-35.0, -34.0, -59.0, -58.0)).thenReturn(
                new OrganizacionMapaZonaResponse(List.of(new OrganizacionMapaResponse(
                        1L, "comedor-x-1", "Comedor X", TipoOrganizacion.COMEDOR, EstadoOrganizacion.SIN_RECLAMAR,
                        OrigenOrganizacion.RENACOM, -34.6, -58.4, 0L)), true));

        mockMvc.perform(get("/api/organizaciones/mapa/zona")
                        .param("minLat", "-35").param("maxLat", "-34")
                        .param("minLng", "-59").param("maxLng", "-58"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Cache-Control", "max-age=60, public"))
                .andExpect(jsonPath("$.data.pins[0].slug").value("comedor-x-1"))
                .andExpect(jsonPath("$.data.truncated").value(true));
    }

    @Test
    void mapaZonaAnswers400WhenTheServiceRejectsTheBox() throws Exception {
        when(organizacionService.listarMapaZona(null, null, null, null))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "obligatorios"));

        mockMvc.perform(get("/api/organizaciones/mapa/zona"))
                .andExpect(status().isBadRequest());
    }
}
