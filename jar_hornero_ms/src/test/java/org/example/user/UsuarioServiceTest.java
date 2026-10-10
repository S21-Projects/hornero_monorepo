package org.example.user;

import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private OrganizacionRepository organizacionRepository;

    @Mock
    private org.example.auth.RefreshTokenService refreshTokenService;

    @Mock
    private ActividadService actividadService;

    @InjectMocks
    private UsuarioService usuarioService;

    @Test
    void toggleActivo_deactivatingReferente_unassignsAllOwnedOrganizaciones() {
        Referente referente = new Referente(1L, "Ref Test", "ref@test.com", "encoded", true);

        Organizacion org1 = new Organizacion();
        org1.setId(10L);
        org1.setReferente(referente);

        Organizacion org2 = new Organizacion();
        org2.setId(11L);
        org2.setReferente(referente);

        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(referente));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));
        when(organizacionRepository.findByReferente_Id(1L)).thenReturn(List.of(org1, org2));

        usuarioService.toggleActivo(1L, false);

        assertThat(org1.getReferente()).isNull();
        assertThat(org2.getReferente()).isNull();
        verify(organizacionRepository).saveAll(ArgumentMatchers.anyList());
    }

    @Test
    void toggleActivo_deactivatingDonante_doesNotTouchOrganizaciones() {
        Donante donante = new Donante(2L, "Donante Test", "donante@test.com", "encoded", true);

        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(donante));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        usuarioService.toggleActivo(2L, false);

        verify(organizacionRepository, never()).findByReferente_Id(anyLong());
        verify(organizacionRepository, never()).saveAll(ArgumentMatchers.anyList());
    }

    @Test
    void toggleActivo_activatingReferente_doesNotUnassignOrganizaciones() {
        Referente referente = new Referente(1L, "Ref Test", "ref@test.com", "encoded", false);

        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(referente));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        usuarioService.toggleActivo(1L, true);

        verify(organizacionRepository, never()).findByReferente_Id(anyLong());
    }

    @Test
    void toggleActivo_deactivating_revokesTheUsersRefreshTokens() {
        Donante donante = new Donante(7L, "Don", "don@test.com", "encoded", true);
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(donante));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        usuarioService.toggleActivo(7L, false);

        verify(refreshTokenService).revokeAllFor(7L);
    }

    @Test
    void toggleActivo_activating_doesNotRevokeTokens() {
        Donante donante = new Donante(7L, "Don", "don@test.com", "encoded", false);
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(donante));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        usuarioService.toggleActivo(7L, true);

        verify(refreshTokenService, never()).revokeAllFor(any());
    }

    @Test
    void toggleActivo_deactivating_recordsActorlessEntryInSameTransactionWithBeforeAfterAndReason() {
        Donante donante = new Donante(7L, "Don", "don@test.com", "encoded", true);
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(donante));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        usuarioService.toggleActivo(7L, false, "abuso reiterado");

        org.mockito.ArgumentCaptor<ActividadService.Registro> captor =
                org.mockito.ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService).registrar(captor.capture());
        ActividadService.Registro r = captor.getValue();
        assertThat(r.accion()).isEqualTo(TipoActividad.USUARIO_DESACTIVADO);
        assertThat(r.entidadTipo()).isEqualTo("USUARIO");
        assertThat(r.entidadId()).isEqualTo(7L);
        assertThat(r.antes()).isEqualTo("activo");
        assertThat(r.despues()).isEqualTo("inactivo");
        assertThat(r.motivo()).isEqualTo("abuso reiterado");
        verify(actividadService, never()).registrarAislado(any());
    }

    @Test
    void toggleActivo_activating_recordsUsuarioActivado() {
        Donante donante = new Donante(7L, "Don", "don@test.com", "encoded", false);
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(donante));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        usuarioService.toggleActivo(7L, true);

        org.mockito.ArgumentCaptor<ActividadService.Registro> captor =
                org.mockito.ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService).registrar(captor.capture());
        assertThat(captor.getValue().accion()).isEqualTo(TipoActividad.USUARIO_ACTIVADO);
        assertThat(captor.getValue().antes()).isEqualTo("inactivo");
    }
}
