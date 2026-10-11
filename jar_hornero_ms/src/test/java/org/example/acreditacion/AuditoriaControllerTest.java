package org.example.acreditacion;

import org.example.acreditacion.dto.EvidenciaEnColaResponse;
import org.example.acreditacion.dto.TabCola;
import org.example.auth.JwtService;
import org.example.domain.EstadoEvidencia;
import org.example.domain.NivelAcreditacion;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEvidencia;
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
import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AD-8 (tesis-core-features, slice 4a), `specs/auditoria-cola-global/spec.md`: the cross-org audit
 * queue endpoint must not fall through to the {@code permitAll} block for
 * {@code GET /api/organizaciones/**} — it lives under a dedicated {@code /api/auditoria/**} root,
 * so {@code @Import(SecurityConfig.class)} (not {@code @WebMvcTest}'s default security
 * auto-configuration) is required to exercise the real matcher, mirroring
 * {@code AcreditacionControllerSecurityTest}.
 */
@WebMvcTest(AuditoriaController.class)
@Import(SecurityConfig.class)
class AuditoriaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AcreditacionService acreditacionService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private org.example.user.UsuarioRepository usuarioRepository;

    private static UsernamePasswordAuthenticationToken auth(long userId, String role) {
        return new UsernamePasswordAuthenticationToken(userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    private EvidenciaEnColaResponse sampleRow() {
        return new EvidenciaEnColaResponse(10L, 1L, "Comedor Norte", NivelAcreditacion.N1,
                RequisitoAcreditacion.NO_DISCRIMINACION, NivelAcreditacion.N1, TipoEvidencia.DECLARACION,
                null, "declaración", LocalDate.now(), null, EstadoEvidencia.PENDIENTE, false, 5L,
                Instant.now(), null, null, null);
    }

    @Test
    void anonymous_isDenied() throws Exception {
        mockMvc.perform(get("/api/auditoria/evidencias"))
                .andExpect(status().isForbidden());
    }

    @Test
    void referente_isForbidden() throws Exception {
        mockMvc.perform(get("/api/auditoria/evidencias").with(authentication(auth(5L, "REFERENTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void donante_isForbidden() throws Exception {
        mockMvc.perform(get("/api/auditoria/evidencias").with(authentication(auth(9L, "DONANTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void admin_succeeds() throws Exception {
        when(acreditacionService.colaAuditoria(any(), any())).thenReturn(
                new PageImpl<>(List.of(sampleRow()), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/auditoria/evidencias").with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isOk());
    }

    @Test
    void emptyFilterCombination_returnsOkNotError() throws Exception {
        when(acreditacionService.colaAuditoria(any(), any())).thenReturn(
                new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        mockMvc.perform(get("/api/auditoria/evidencias")
                        .param("tab", "VENCIDAS")
                        .param("nivel", "N2")
                        .param("requisito", "RADIO_50KM_BANCO_ALIMENTOS")
                        .param("tipoEvidencia", "FOTO")
                        .with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isOk());
    }
}
