package org.example.acreditacion;

import org.example.acreditacion.dto.AcreditacionResponse;
import org.example.acreditacion.dto.EvidenciaResponse;
import org.example.acreditacion.dto.LegajoResponse;
import org.example.domain.EstadoEvidencia;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEvidencia;
import org.example.auth.JwtService;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvidencia;
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
import java.time.LocalDate;
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

    // --- GET /{id}/acreditacion/evidencias — D-02 audit queue, ADMINISTRADOR only ---

    /**
     * D-02 is deliberately narrower than D-01: the owning REFERENTE already reads its evidence
     * state through the legajo and has no approve/observe action, so it needs no row identifiers.
     */
    private EvidenciaResponse sampleEvidencia() {
        return new EvidenciaResponse(10L, 1L, RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.DECLARACION,
                "declaración", LocalDate.now(), null, EstadoEvidencia.PENDIENTE, false, 5L, Instant.now(),
                null, null, null);
    }

    @Test
    void listEvidencias_anonymous_isDenied() throws Exception {
        mockMvc.perform(get("/api/organizaciones/1/acreditacion/evidencias"))
                .andExpect(status().isForbidden());
    }

    @Test
    void listEvidencias_donante_isForbidden() throws Exception {
        mockMvc.perform(get("/api/organizaciones/1/acreditacion/evidencias").with(authentication(auth(9L, "DONANTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void listEvidencias_owningReferente_isForbidden() throws Exception {
        when(organizacionRepository.findById(1L)).thenReturn(Optional.of(orgOwnedBy(5L)));

        mockMvc.perform(get("/api/organizaciones/1/acreditacion/evidencias").with(authentication(auth(5L, "REFERENTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void listEvidencias_admin_isOk() throws Exception {
        when(acreditacionService.evidencias(1L, null)).thenReturn(List.of(sampleEvidencia()));

        mockMvc.perform(get("/api/organizaciones/1/acreditacion/evidencias").with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isOk());
    }

    // --- Threat Matrix row 5: evidence key smuggling ---

    /**
     * Slice A (task 2.14/2.15): the {@code objectKey}-non-null guard rejected every submission
     * carrying one, since no authenticated route existed to serve a file at that key. Task 6.7
     * (Slice B) scopes that guard to non-{@code FOTO}/{@code DOCUMENTO} submissions only, now that
     * the BFF's ownership-checked {@code evidencia-files} route exists — this test pins the
     * narrowed rule: a {@code DECLARACION} row still cannot carry an {@code objectKey}.
     */
    @Test
    void postEvidencia_declaracionWithNonNullObjectKey_isRejectedWith400() throws Exception {
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
                                {"requisito":"NO_DISCRIMINACION","tipoEvidencia":"DECLARACION","objectKey":"org-evidencia/1/x.jpg"}
                                """))
                .andExpect(status().isBadRequest());
    }

    /**
     * Task 6.7's controlled widening: a {@code FOTO} submission with an {@code objectKey} is now
     * accepted (the guard no longer rejects it outright) — the request reaches the service layer
     * instead of failing validation.
     */
    @Test
    void postEvidencia_fotoWithObjectKey_isAccepted() throws Exception {
        Referente owner = new Referente(7L, "Owner", "owner@test.com", "x", true);
        Organizacion org = new Organizacion();
        org.setId(1L);
        org.setEstado(EstadoOrganizacion.PENDIENTE);
        org.setReferente(owner);
        when(organizacionRepository.findById(1L)).thenReturn(Optional.of(org));
        when(acreditacionService.cargarEvidencia(org, RequisitoAcreditacion.CONDICIONES_SANITARIAS_ADECUADAS,
                TipoEvidencia.FOTO, null, null, null, 7L))
                .thenReturn(sampleEvidenciaFoto(org));

        mockMvc.perform(post("/api/organizaciones/1/acreditacion/evidencias")
                        .with(authentication(auth(7L, "REFERENTE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"requisito":"CONDICIONES_SANITARIAS_ADECUADAS","tipoEvidencia":"FOTO","objectKey":"org-evidencia/1/x.jpg"}
                                """))
                .andExpect(status().isCreated());
    }

    private OrganizacionEvidencia sampleEvidenciaFoto(Organizacion organizacion) {
        return OrganizacionEvidencia.nueva(
                organizacion, RequisitoAcreditacion.CONDICIONES_SANITARIAS_ADECUADAS, TipoEvidencia.FOTO,
                null, null, null, 7L);
    }
}
