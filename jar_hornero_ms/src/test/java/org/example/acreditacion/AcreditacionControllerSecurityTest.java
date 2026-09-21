package org.example.acreditacion;

import org.example.acreditacion.dto.AcreditacionResponse;
import org.example.acreditacion.dto.LegajoResponse;
import org.example.auth.JwtService;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.config.SecurityConfig;
import org.example.user.Referente;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AD-8, the single highest-severity risk in this change: the new GET routes must NOT fall through
 * to the existing {@code permitAll} block for {@code GET /api/organizaciones/**}.
 *
 * <p>{@code @Import(SecurityConfig.class)} is required, not decorative: without it, Spring Boot's
 * default security auto-configuration (an implicit httpBasic() chain) answers instead of our
 * custom filter chain — masking the exact matcher-order/role leak this test exists to catch, and
 * masking the finding below.
 *
 * <p><b>Finding, not literal task wording</b>: this app's real {@code SecurityConfig} configures
 * no {@code httpBasic()}/{@code formLogin()} and no custom {@code AuthenticationEntryPoint}
 * anywhere, so Spring Security's default {@code Http403ForbiddenEntryPoint} answers both
 * "anonymous" and "wrong role" with {@code 403}, not the {@code 401} tasks.md's plan describes for
 * the anonymous case. Verified by exercising the real chain via {@code @Import(SecurityConfig.class)}
 * rather than {@code @WebMvcTest}'s default security auto-configuration fallback (which DOES
 * answer 401, but only because it substitutes Boot's own default chain — proving nothing about
 * this app's actual matcher). What matters for AD-8 holds regardless of the exact status code:
 * anonymous and wrong-role requests are both denied, never routed to the controller.
 */
@WebMvcTest(AcreditacionController.class)
@Import(SecurityConfig.class)
class AcreditacionControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AcreditacionService acreditacionService;

    @MockBean
    private OrganizacionRepository organizacionRepository;

    @MockBean
    private JwtService jwtService;

    private static UsernamePasswordAuthenticationToken auth(long userId, String role) {
        return new UsernamePasswordAuthenticationToken(userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    private AcreditacionResponse sampleAcreditacion() {
        return new AcreditacionResponse(1L, NivelAcreditacion.N1, Instant.now());
    }

    private LegajoResponse sampleLegajo() {
        return new LegajoResponse(1L, "Comedor", "comedor", "Calle 1",
                NivelAcreditacion.N1, Instant.now(), List.of(), List.of(), "disclosure");
    }

    // --- GET /{id}/legajo ---

    @Test
    void legajo_anonymous_isDenied() throws Exception {
        mockMvc.perform(get("/api/organizaciones/1/legajo"))
                .andExpect(status().isForbidden());
    }

    @Test
    void legajo_donante_isForbidden() throws Exception {
        mockMvc.perform(get("/api/organizaciones/1/legajo").with(authentication(auth(9L, "DONANTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void legajo_admin_isOk() throws Exception {
        when(acreditacionService.legajo(1L)).thenReturn(sampleLegajo());

        mockMvc.perform(get("/api/organizaciones/1/legajo").with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isOk());
    }

    // --- GET /{id}/acreditacion ---

    @Test
    void acreditacion_anonymous_isDenied() throws Exception {
        mockMvc.perform(get("/api/organizaciones/1/acreditacion"))
                .andExpect(status().isForbidden());
    }

    @Test
    void acreditacion_donante_isForbidden() throws Exception {
        mockMvc.perform(get("/api/organizaciones/1/acreditacion").with(authentication(auth(9L, "DONANTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void acreditacion_admin_isOk() throws Exception {
        when(acreditacionService.acreditacion(1L)).thenReturn(sampleAcreditacion());

        mockMvc.perform(get("/api/organizaciones/1/acreditacion").with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isOk());
    }

    // --- Amendment D-01: the owning REFERENTE reads its own organizacion ---

    /**
     * {@code decisiones-posteriores.md} D-01 amends the design, which had restricted
     * {@code GET /{id}/legajo} and {@code GET /{id}/acreditacion} to {@code ADMINISTRADOR}: the
     * owning {@code REFERENTE} exports its own organizacion's information. These four tests pin
     * both halves of that rule on both routes. They are regression protection for behaviour the
     * controller already implements correctly, so no RED was observed for them.
     */
    private Organizacion orgOwnedBy(long referenteId) {
        Referente owner = new Referente(referenteId, "Owner", "owner@test.com", "x", true);
        Organizacion org = new Organizacion();
        org.setId(1L);
        org.setEstado(EstadoOrganizacion.PENDIENTE);
        org.setReferente(owner);
        return org;
    }

    @Test
    void legajo_owningReferente_isOk() throws Exception {
        when(organizacionRepository.findById(1L)).thenReturn(Optional.of(orgOwnedBy(5L)));
        when(acreditacionService.legajo(1L)).thenReturn(sampleLegajo());

        mockMvc.perform(get("/api/organizaciones/1/legajo").with(authentication(auth(5L, "REFERENTE"))))
                .andExpect(status().isOk());
    }

    @Test
    void legajo_nonOwningReferente_isForbidden() throws Exception {
        when(organizacionRepository.findById(1L)).thenReturn(Optional.of(orgOwnedBy(5L)));

        mockMvc.perform(get("/api/organizaciones/1/legajo").with(authentication(auth(7L, "REFERENTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void acreditacion_owningReferente_isOk() throws Exception {
        when(organizacionRepository.findById(1L)).thenReturn(Optional.of(orgOwnedBy(5L)));
        when(acreditacionService.acreditacion(1L)).thenReturn(sampleAcreditacion());

        mockMvc.perform(get("/api/organizaciones/1/acreditacion").with(authentication(auth(5L, "REFERENTE"))))
                .andExpect(status().isOk());
    }

    @Test
    void acreditacion_nonOwningReferente_isForbidden() throws Exception {
        when(organizacionRepository.findById(1L)).thenReturn(Optional.of(orgOwnedBy(5L)));

        mockMvc.perform(get("/api/organizaciones/1/acreditacion").with(authentication(auth(7L, "REFERENTE"))))
                .andExpect(status().isForbidden());
    }

    // --- Ownership: non-owning REFERENTE posting evidence ---

    @Test
    void postEvidencia_nonOwningReferente_isForbidden() throws Exception {
        Referente owner = new Referente(5L, "Owner", "owner@test.com", "x", true);
        Organizacion org = new Organizacion();
        org.setId(1L);
        org.setEstado(EstadoOrganizacion.PENDIENTE);
        org.setReferente(owner);
        when(organizacionRepository.findById(1L)).thenReturn(Optional.of(org));

        mockMvc.perform(post("/api/organizaciones/1/acreditacion/evidencias")
                        .with(authentication(auth(7L, "REFERENTE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"requisito":"NO_DISCRIMINACION","tipoEvidencia":"DECLARACION","declaracion":"d"}
                                """))
                .andExpect(status().isForbidden());
    }

    // --- Threat Matrix row 5: evidence key smuggling (Slice A) ---

    /**
     * Deviation from strict RED-before-GREEN ordering: the {@code objectKey}-non-null guard
     * (task 2.14/2.15) was written into {@code AcreditacionController} at controller-creation time
     * (task 2.13), since a controller method with no body at all cannot compile with a partial
     * validation branch added later in isolation. This test triangulates the guard.
     */
    @Test
    void postEvidencia_withNonNullObjectKey_isRejectedWith400() throws Exception {
        Referente owner = new Referente(7L, "Owner", "owner@test.com", "x", true);
        Organizacion org = new Organizacion();
        org.setId(1L);
        org.setEstado(EstadoOrganizacion.PENDIENTE);
        org.setReferente(owner);
        when(organizacionRepository.findById(1L)).thenReturn(Optional.of(org));

        mockMvc.perform(post("/api/organizaciones/1/acreditacion/evidencias")
                        .with(authentication(auth(7L, "REFERENTE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"requisito":"NO_DISCRIMINACION","tipoEvidencia":"FOTO","objectKey":"org-evidencia/1/x.jpg"}
                                """))
                .andExpect(status().isBadRequest());
    }
}
