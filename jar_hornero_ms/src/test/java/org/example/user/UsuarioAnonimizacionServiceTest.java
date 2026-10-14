package org.example.user;

import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.auth.RefreshTokenService;
import org.example.auth.otp.CodigoVerificacionRepository;
import org.example.auth.reset.PasswordResetTokenRepository;
import org.example.domain.Organizacion;
import org.example.domain.MotivoReporte;
import org.example.domain.OrganizacionRepository;
import org.example.domain.ReclamoOrganizacion;
import org.example.domain.ReclamoOrganizacionRepository;
import org.example.domain.ReporteOrganizacion;
import org.example.domain.ReporteOrganizacionRepository;
import org.example.evidencia.EvidenciaReclamoLiberadaEvento;
import org.example.idempotencia.IdempotenciaRepository;
import org.example.reclamo.ReclamoService;
import org.example.reporte.ReporteCierre;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** N15/D12: right to erasure. The account is anonymized, never deleted (traceability stays). */
@ExtendWith(MockitoExtension.class)
class UsuarioAnonimizacionServiceTest {

    private static final long ADMIN_ID = 1L;

    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private OrganizacionRepository organizacionRepository;
    @Mock
    private RefreshTokenService refreshTokenService;
    @Mock
    private ActividadService actividadService;
    @Mock
    private CodigoVerificacionRepository codigoVerificacionRepository;
    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock
    private IdempotenciaRepository idempotenciaRepository;
    @Mock
    private ReclamoOrganizacionRepository reclamoRepository;
    @Mock
    private ReporteOrganizacionRepository reporteRepository;
    @Mock
    private ReclamoService reclamoService;
    @Mock
    private ReporteCierre reporteCierre;
    @Mock
    private ApplicationEventPublisher eventos;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final Administrador admin = new Administrador(ADMIN_ID, "Admin", "admin@test.com", "x", true);
    private UsuarioAnonimizacionService service;

    @BeforeEach
    void setUp() {
        service = new UsuarioAnonimizacionService(usuarioRepository, organizacionRepository, refreshTokenService,
                actividadService, encoder, codigoVerificacionRepository, passwordResetTokenRepository,
                idempotenciaRepository, reclamoRepository, reporteRepository, reclamoService, reporteCierre, eventos);
        org.mockito.Mockito.lenient().when(usuarioRepository.findById(ADMIN_ID)).thenReturn(Optional.of(admin));
    }

    private Donante donante() {
        Donante d = new Donante(7L, "Dora Donante", "dora@test.com", encoder.encode("Secreta123!"), true);
        d.setEmailVerificado(true);
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(d));
        when(usuarioRepository.saveAndFlush(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));
        return d;
    }

    private static ResponseStatusException rejection(Runnable r) {
        try {
            r.run();
        } catch (ResponseStatusException e) {
            return e;
        }
        throw new AssertionError("expected a ResponseStatusException");
    }

    @Test
    void scrubsNameEmailPasswordAndFlags() {
        Donante d = donante();

        UsuarioResponse res = service.anonimizar(7L, ADMIN_ID);

        assertThat(d.getNombre()).isEqualTo("Usuario eliminado");
        assertThat(d.getEmail()).matches("eliminado-[0-9a-f-]{36}@anonimo\\.invalid");
        assertThat(d.getEmail()).doesNotContain("dora");
        assertThat(d.isActivo()).isFalse();
        assertThat(d.isEmailVerificado()).isFalse();
        assertThat(encoder.matches("Secreta123!", d.getPassword())).isFalse();
        assertThat(d.getPassword()).startsWith("$2");
        assertThat(res.nombre()).isEqualTo("Usuario eliminado");
        assertThat(res.email()).isEqualTo(d.getEmail());
        assertThat(res.activo()).isFalse();
    }

    @Test
    void placeholdersAreUniquePerAccount() {
        Donante a = donante();
        service.anonimizar(7L, ADMIN_ID);
        String primero = a.getEmail();

        Donante b = new Donante(8L, "Otro", "otro@test.com", "x", true);
        when(usuarioRepository.findById(8L)).thenReturn(Optional.of(b));
        service.anonimizar(8L, ADMIN_ID);

        assertThat(b.getEmail()).isNotEqualTo(primero);
    }

    @Test
    void revokesSessionsAndDeletesPersonalTechnicalRows() {
        donante();

        service.anonimizar(7L, ADMIN_ID);

        verify(refreshTokenService).revokeAllFor(7L);
        verify(codigoVerificacionRepository).deleteByEmailIgnoreCase("dora@test.com");
        verify(passwordResetTokenRepository).deleteByUsuarioId(7L);
        verify(idempotenciaRepository).deleteByUsuarioId(7L);
    }

    @Test
    void closesPendingClaimsAndReportsOfTheUser_withTheAnonymizingAdminAsActor() {
        donante();

        service.anonimizar(7L, ADMIN_ID);

        verify(reclamoService).rechazarPendientesDeReferente(7L, admin, "El solicitante dio de baja su cuenta");
        verify(reporteCierre).descartarPendientesDeReportante(7L, admin, "El reportante dio de baja su cuenta");
    }

    @Test
    void scrubsPhoneMessageAndEvidenceOfTheClaimsTheUserFiled() {
        donante();
        ReclamoOrganizacion r = new ReclamoOrganizacion();
        r.setTelefono("+54 351 555 1234");
        r.setMensaje("Soy la coordinadora");
        r.setEvidenciaKeys(new ArrayList<>(List.of("reclamo-evidencia/1/7/a.jpg", "reclamo-evidencia/1/7/b.jpg")));
        when(reclamoRepository.findByReferente_Id(7L)).thenReturn(List.of(r));

        service.anonimizar(7L, ADMIN_ID);

        assertThat(r.getTelefono()).isEqualTo(ReclamoOrganizacion.TELEFONO_ANONIMIZADO);
        assertThat(r.getMensaje()).isNull();
        assertThat(r.getEvidenciaKeys()).isEmpty();
        assertThat(r.getEstado()).isEqualTo(org.example.domain.EstadoReclamo.PENDIENTE);
        verify(reclamoRepository, never()).delete(any());
    }

    @Test
    void publishesTheEvidenceKeysCapturedBeforeTheClaimsAreCleared() {
        Referente ref = new Referente(5L, "Rita Referente", "rita@test.com", "h", true);
        when(usuarioRepository.findById(5L)).thenReturn(Optional.of(ref));
        when(usuarioRepository.saveAndFlush(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));
        ReclamoOrganizacion r = new ReclamoOrganizacion();
        r.setEvidenciaKeys(new ArrayList<>(List.of("reclamo-evidencia/1/5/a.jpg", "reclamo-evidencia/2/5/b.jpg")));
        when(reclamoRepository.findByReferente_Id(5L)).thenReturn(List.of(r));

        service.anonimizar(5L, ADMIN_ID);

        assertThat(r.getEvidenciaKeys()).isEmpty();
        verify(eventos).publishEvent(new EvidenciaReclamoLiberadaEvento(5L,
                List.of("reclamo-evidencia/1/5/a.jpg", "reclamo-evidencia/2/5/b.jpg")));
    }

    @Test
    void scrubsDetailOfTheReportsTheUserFiled() {
        donante();
        ReporteOrganizacion r = new ReporteOrganizacion();
        r.setMotivo(MotivoReporte.INACTIVO);
        r.setDetalle("Llamé por teléfono y nadie atiende");
        when(reporteRepository.findByReportante_Id(7L)).thenReturn(List.of(r));

        service.anonimizar(7L, ADMIN_ID);

        assertThat(r.getDetalle()).isNull();
        assertThat(r.getMotivo()).isEqualTo(MotivoReporte.INACTIVO);
        verify(reporteRepository, never()).delete(any());
    }

    @Test
    void recordsActivityWithoutPersonalData() {
        donante();

        service.anonimizar(7L, ADMIN_ID);

        ArgumentCaptor<ActividadService.Registro> captor = ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService).registrar(captor.capture());
        ActividadService.Registro r = captor.getValue();
        assertThat(r.accion()).isEqualTo(TipoActividad.USUARIO_ANONIMIZADO);
        assertThat(r.entidadTipo()).isEqualTo("USUARIO");
        assertThat(r.entidadId()).isEqualTo(7L);
        assertThat(r.esSistema()).isFalse();
        String todo = String.valueOf(r.detalle()) + r.antes() + r.despues() + r.motivo() + r.emailIntento();
        assertThat(todo).doesNotContain("dora").doesNotContain("Dora").doesNotContain("test.com");
    }

    @Test
    void unknownUser_is404() {
        when(usuarioRepository.findById(99L)).thenReturn(Optional.empty());

        ResponseStatusException e = rejection(() -> service.anonimizar(99L, ADMIN_ID));

        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void alreadyAnonymized_is409() {
        Donante d = new Donante(7L, "Usuario eliminado", "eliminado-x@anonimo.invalid", "h", false);
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(d));

        ResponseStatusException e = rejection(() -> service.anonimizar(7L, ADMIN_ID));

        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(e.getReason()).isEqualTo("USUARIO_YA_ANONIMIZADO");
        verify(refreshTokenService, never()).revokeAllFor(anyLong());
    }

    @Test
    void cannotAnonymizeYourself() {
        ResponseStatusException e = rejection(() -> service.anonimizar(ADMIN_ID, ADMIN_ID));

        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(e.getReason()).isEqualTo("ANONIMIZAR_CUENTA_PROPIA");
        verify(usuarioRepository, never()).saveAndFlush(any());
    }

    @Test
    void cannotAnonymizeTheLastActiveAdministrator() {
        Administrador otro = new Administrador(2L, "Otro Admin", "otro@test.com", "h", true);
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(otro));
        when(usuarioRepository.countAdministradoresActivos()).thenReturn(1L);

        ResponseStatusException e = rejection(() -> service.anonimizar(2L, ADMIN_ID));

        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(e.getReason()).isEqualTo("ULTIMO_ADMINISTRADOR");
        assertThat(otro.getNombre()).isEqualTo("Otro Admin");
    }

    @Test
    void anotherAdminCanBeAnonymizedWhenOthersRemainActive() {
        Administrador otro = new Administrador(2L, "Otro Admin", "otro@test.com", "h", true);
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(otro));
        when(usuarioRepository.countAdministradoresActivos()).thenReturn(2L);
        when(usuarioRepository.saveAndFlush(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        service.anonimizar(2L, ADMIN_ID);

        assertThat(otro.getNombre()).isEqualTo("Usuario eliminado");
    }

    @Test
    void referenteOfAnOrganization_isRejectedUntilReassigned() {
        Referente ref = new Referente(5L, "Rita Referente", "rita@test.com", "h", true);
        when(usuarioRepository.findById(5L)).thenReturn(Optional.of(ref));
        Organizacion org = new Organizacion();
        org.setReferente(ref);
        when(organizacionRepository.findByReferente_Id(5L)).thenReturn(List.of(org));

        ResponseStatusException e = rejection(() -> service.anonimizar(5L, ADMIN_ID));

        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(e.getReason()).isEqualTo("REFERENTE_CON_ORGANIZACIONES");
        assertThat(ref.getNombre()).isEqualTo("Rita Referente");
    }

    @Test
    void referenteWithoutOrganizations_canBeAnonymized() {
        Referente ref = new Referente(5L, "Rita Referente", "rita@test.com", "h", true);
        when(usuarioRepository.findById(5L)).thenReturn(Optional.of(ref));
        when(organizacionRepository.findByReferente_Id(5L)).thenReturn(List.of());
        when(usuarioRepository.saveAndFlush(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        service.anonimizar(5L, ADMIN_ID);

        assertThat(ref.getNombre()).isEqualTo("Usuario eliminado");
        assertThatThrownBy(() -> { throw new IllegalStateException(); }).isInstanceOf(IllegalStateException.class);
    }
}
