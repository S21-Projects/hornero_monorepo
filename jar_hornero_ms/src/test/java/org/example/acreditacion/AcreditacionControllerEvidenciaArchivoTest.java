package org.example.acreditacion;

import org.example.auth.JwtService;
import org.example.config.SecurityConfig;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.user.Referente;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AD-12 (tesis-core-features slice 2): {@code GET /{id}/acreditacion/evidencias/archivo} —
 * authorizes reading an evidence file bound to an existing {@code OrganizacionEvidencia} row.
 * Uses the same {@code @Import(SecurityConfig.class)} pattern as
 * {@link AcreditacionControllerSecurityTest} — the route falls under the existing
 * {@code /api/organizaciones/*}/acreditacion/** authenticated matcher (no {@code SecurityConfig}
 * change needed).
 */
@WebMvcTest(AcreditacionController.class)
@Import(SecurityConfig.class)
class AcreditacionControllerEvidenciaArchivoTest {

    private static final String PATH = "/api/organizaciones/1/acreditacion/evidencias/archivo";
    private static final String KEY = "org-evidencia/1/foto.jpg";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AcreditacionService acreditacionService;

    @MockBean
    private EvidenciaDescargaAuditor descargaAuditor;

    @MockBean
    private OrganizacionRepository organizacionRepository;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private org.example.user.UsuarioRepository usuarioRepository;

    private static UsernamePasswordAuthenticationToken auth(long userId, String role) {
        return new UsernamePasswordAuthenticationToken(userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    private Organizacion orgOwnedBy(long referenteId) {
        Referente owner = new Referente(referenteId, "Owner", "owner@test.com", "x", true);
        Organizacion org = new Organizacion();
        org.setId(1L);
        org.setEstado(EstadoOrganizacion.PENDIENTE);
        org.setReferente(owner);
        return org;
    }

    @Test
    void anonymousIsDenied() throws Exception {
        mockMvc.perform(get(PATH).param("objectKey", KEY))
                .andExpect(status().isForbidden());
        verifyNoInteractions(acreditacionService);
    }

    @Test
    void donanteIsForbidden() throws Exception {
        mockMvc.perform(get(PATH).param("objectKey", KEY).with(authentication(auth(9L, "DONANTE"))))
                .andExpect(status().isForbidden());
        verifyNoInteractions(acreditacionService);
    }

    @Test
    void nonOwningReferenteIsForbiddenBeforeAnyRowLookup() throws Exception {
        when(organizacionRepository.findById(1L)).thenReturn(Optional.of(orgOwnedBy(5L)));

        mockMvc.perform(get(PATH).param("objectKey", KEY).with(authentication(auth(7L, "REFERENTE"))))
                .andExpect(status().isForbidden());
        verifyNoInteractions(acreditacionService);
    }

    @Test
    void owningReferenteWithAMatchingRowGets204() throws Exception {
        when(organizacionRepository.findById(1L)).thenReturn(Optional.of(orgOwnedBy(5L)));
        doNothing().when(acreditacionService).existeArchivoEvidencia(1L, KEY);

        mockMvc.perform(get(PATH).param("objectKey", KEY).with(authentication(auth(5L, "REFERENTE"))))
                .andExpect(status().isNoContent());
        verify(acreditacionService).existeArchivoEvidencia(1L, KEY);
        verifyNoInteractions(descargaAuditor);
    }

    @Test
    void adminWithAMatchingRowGets204() throws Exception {
        doNothing().when(acreditacionService).existeArchivoEvidencia(1L, KEY);

        mockMvc.perform(get(PATH).param("objectKey", KEY).with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isNoContent());
        verify(acreditacionService).existeArchivoEvidencia(1L, KEY);
        verify(descargaAuditor).registrar(1L, KEY);
    }

    @Test
    void adminDownloadIsNotRecordedWhenTheAuthorizationFails() throws Exception {
        doThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "EVIDENCIA_NO_ENCONTRADA"))
                .when(acreditacionService).existeArchivoEvidencia(1L, KEY);

        mockMvc.perform(get(PATH).param("objectKey", KEY).with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isNotFound());
        verifyNoInteractions(descargaAuditor);
    }

    @Test
    void adminWithNoMatchingRowGets404() throws Exception {
        doThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "EVIDENCIA_NO_ENCONTRADA"))
                .when(acreditacionService).existeArchivoEvidencia(1L, KEY);

        mockMvc.perform(get(PATH).param("objectKey", KEY).with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void adminWithABadKeyGets400() throws Exception {
        String badKey = "org-evidencia/1/../secreto";
        doThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "EVIDENCIA_CLAVE_INVALIDA"))
                .when(acreditacionService).existeArchivoEvidencia(eq(1L), eq(badKey));

        mockMvc.perform(get(PATH).param("objectKey", badKey).with(authentication(auth(2L, "ADMINISTRADOR"))))
                .andExpect(status().isBadRequest());
    }
}
