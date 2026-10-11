package org.example.auth;

import org.example.actividad.ActividadService;
import org.example.actividad.ResultadoActividad;
import org.example.actividad.TipoActividad;
import org.example.actividad.TipoActor;
import org.example.auth.dto.RegisterRequest;
import org.example.auth.dto.ResendOtpRequest;
import org.example.auth.dto.VerifyOtpRequest;
import org.example.auth.otp.OtpService;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private JwtService jwtService;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Mock
    private OtpService otpService;

    @Mock
    private RefreshTokenService refreshTokenService;

    @Mock
    private ActividadService actividadService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(usuarioRepository, jwtService, passwordEncoder, otpService, refreshTokenService, new PasswordPolicy(), actividadService);
    }

    // --- register: HIGH PRIORITY risk area (mail dispatch failure must not block registration) ---

    @Test
    void register_otpIssueThrows_stillPersistsUserAndIssuesTokens() {
        RegisterRequest request = new RegisterRequest("Donante Test", "donante@test.com", "correct-horse-battery-staple", "DONANTE");

        when(usuarioRepository.findByEmail("donante@test.com")).thenReturn(Optional.empty());
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(inv -> {
            Usuario u = inv.getArgument(0);
            u.setId(1L);
            return u;
        });
        doThrow(new RuntimeException("resend down")).when(otpService).issue("donante@test.com");
        when(jwtService.generateAccessToken(any())).thenReturn("access-token");
        when(refreshTokenService.issue(any())).thenReturn("refresh-token");

        assertThatCode(() -> {
            var response = authService.register(request);
            assertThat(response.getAccessToken()).isEqualTo("access-token");
            assertThat(response.getRefreshToken()).isEqualTo("refresh-token");
        }).doesNotThrowAnyException();

        verify(usuarioRepository, times(1)).save(any(Usuario.class));
    }

    @Test
    void register_newUser_startsUnverifiedAndIssuesOtp() {
        RegisterRequest request = new RegisterRequest("Referente Test", "ref@test.com", "correct-horse-battery-staple", "REFERENTE");

        when(usuarioRepository.findByEmail("ref@test.com")).thenReturn(Optional.empty());
        ArgumentCaptor<Usuario> captor = ArgumentCaptor.forClass(Usuario.class);
        when(usuarioRepository.save(captor.capture())).thenAnswer(inv -> {
            Usuario u = inv.getArgument(0);
            u.setId(2L);
            return u;
        });
        when(jwtService.generateAccessToken(any())).thenReturn("access-token");
        when(refreshTokenService.issue(any())).thenReturn("refresh-token");

        var response = authService.register(request);

        assertThat(captor.getValue()).isInstanceOf(Referente.class);
        assertThat(captor.getValue().isEmailVerificado()).isFalse();
        assertThat(response.getUser().isEmailVerificado()).isFalse();
        verify(otpService).issue("ref@test.com");
    }

    @Test
    void register_emailAlreadyRegistered_throws409() {
        RegisterRequest request = new RegisterRequest("Test", "dup@test.com", "correct-horse-battery-staple", "DONANTE");
        when(usuarioRepository.findByEmail("dup@test.com")).thenReturn(Optional.of(new Donante()));

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");

        verify(otpService, never()).issue(anyString());
    }

    @Test
    void register_weakPassword_throws400WithCodeAndPersistsNothing() {
        RegisterRequest request = new RegisterRequest("Test", "weak@test.com", "short", "DONANTE");

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                    assertThat(ex.getStatusCode().value()).isEqualTo(400);
                    assertThat(ex.getReason()).isEqualTo("PASSWORD_DEMASIADO_CORTA");
                });

        verify(usuarioRepository, never()).save(any(Usuario.class));
        verify(otpService, never()).issue(anyString());
    }

    @Test
    void register_passwordContainingEmailLocalPart_throws400() {
        RegisterRequest request = new RegisterRequest("Test User", "marisol.vega@test.com", "x-marisol.vega-clave-9", "DONANTE");

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        ex -> assertThat(ex.getReason()).isEqualTo("PASSWORD_CONTIENE_DATOS_PERSONALES"));
    }

    // --- verifyOtp ---

    @Test
    void verifyOtp_validCode_marksVerifiedAndReissuesTokens() {
        Referente referente = new Referente(3L, "Ref", "ref@test.com", "encoded", true);
        referente.setEmailVerificado(false);

        when(usuarioRepository.findByEmail("ref@test.com")).thenReturn(Optional.of(referente));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jwtService.generateAccessToken(any())).thenReturn("access-token");
        when(refreshTokenService.issue(any())).thenReturn("refresh-token");

        var response = authService.verifyOtp(new VerifyOtpRequest("ref@test.com", "123456"));

        verify(otpService).verify("ref@test.com", "123456");
        assertThat(referente.isEmailVerificado()).isTrue();
        assertThat(response.getUser().isEmailVerificado()).isTrue();
    }

    @Test
    void verifyOtp_unknownEmail_throws400WithoutCallingOtpService() {
        when(usuarioRepository.findByEmail("ghost@test.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.verifyOtp(new VerifyOtpRequest("ghost@test.com", "123456")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");

        verify(otpService, never()).verify(anyString(), anyString());
    }

    // --- resendOtp: no enumeration oracle ---

    @Test
    void resendOtp_existingEmail_delegatesToOtpService() {
        when(usuarioRepository.findByEmail("ref@test.com")).thenReturn(Optional.of(new Referente()));

        authService.resendOtp(new ResendOtpRequest("ref@test.com"));

        verify(otpService).resend("ref@test.com");
    }

    @Test
    void resendOtp_unknownEmail_returnsSilentlyWithoutCallingOtpService() {
        when(usuarioRepository.findByEmail("ghost@test.com")).thenReturn(Optional.empty());

        assertThatCode(() -> authService.resendOtp(new ResendOtpRequest("ghost@test.com")))
                .doesNotThrowAnyException();

        verify(otpService, never()).resend(anyString());
    }

    // --- refresh: only genuine refresh tokens are accepted ---

    @Test
    void refresh_accessTokenInsteadOfRefresh_throws401() {
        when(jwtService.isRefreshToken("access-token")).thenReturn(false);

        assertThatThrownBy(() -> authService.refresh("access-token"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("401");

        verify(usuarioRepository, never()).findById(any());
    }

    @Test
    void refresh_validRefreshToken_rotatesAndIssuesNewTokens() {
        Referente referente = new Referente(4L, "Ref", "ref@test.com", "encoded", true);
        when(jwtService.isRefreshToken("refresh-token")).thenReturn(true);
        when(jwtService.extractJti("refresh-token")).thenReturn("jti-1");
        when(jwtService.extractUserId("refresh-token")).thenReturn(4L);
        when(usuarioRepository.findById(4L)).thenReturn(Optional.of(referente));
        when(jwtService.generateAccessToken(referente)).thenReturn("new-access");
        when(refreshTokenService.rotate("jti-1", referente)).thenReturn("new-refresh");

        var response = authService.refresh("refresh-token");

        assertThat(response.getAccessToken()).isEqualTo("new-access");
        assertThat(response.getRefreshToken()).isEqualTo("new-refresh");
    }

    @Test
    void refresh_tokenWithoutJti_throws401() {
        when(jwtService.isRefreshToken("legacy")).thenReturn(true);
        when(jwtService.extractJti("legacy")).thenReturn(null);

        assertThatThrownBy(() -> authService.refresh("legacy"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("401");
        verify(refreshTokenService, never()).rotate(any(), any());
    }

    @Test
    void refresh_inactiveUser_throws401WithoutRotating() {
        Referente referente = new Referente(4L, "Ref", "ref@test.com", "encoded", false);
        when(jwtService.isRefreshToken("refresh-token")).thenReturn(true);
        when(jwtService.extractJti("refresh-token")).thenReturn("jti-1");
        when(jwtService.extractUserId("refresh-token")).thenReturn(4L);
        when(usuarioRepository.findById(4L)).thenReturn(Optional.of(referente));

        assertThatThrownBy(() -> authService.refresh("refresh-token"))
                .isInstanceOf(ResponseStatusException.class);
        verify(refreshTokenService, never()).rotate(any(), any());
    }

    // --- logout: revokes the family, never reveals whether the token was valid ---

    @Test
    void logout_validRefreshToken_revokesItsFamily() {
        when(jwtService.isRefreshToken("refresh-token")).thenReturn(true);
        when(jwtService.extractJti("refresh-token")).thenReturn("jti-1");

        authService.logout("refresh-token");

        verify(refreshTokenService).revokeFamilyOf("jti-1");
    }

    @Test
    void logout_invalidToken_doesNothingAndDoesNotThrow() {
        when(jwtService.isRefreshToken("garbage")).thenReturn(false);

        assertThatCode(() -> authService.logout("garbage")).doesNotThrowAnyException();
        verify(refreshTokenService, never()).revokeFamilyOf(any());
    }

    // --- N10: activity log hooks (ASVS 16.3.1) ---

    private ActividadService.Registro capturarAislado() {
        ArgumentCaptor<ActividadService.Registro> captor = ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService).registrarAislado(captor.capture());
        return captor.getValue();
    }

    @Test
    void login_wrongPassword_recordsIsolatedFailureWithAttemptedEmailAndNoPassword() {
        Donante u = new Donante(5L, "Don", "don@test.com", passwordEncoder.encode("correct-horse-battery-staple"), true);
        when(usuarioRepository.findByEmail("don@test.com")).thenReturn(Optional.of(u));

        assertThatThrownBy(() -> authService.login(new org.example.auth.dto.LoginRequest("don@test.com", "wrong-password-123")))
                .isInstanceOf(ResponseStatusException.class);

        ActividadService.Registro r = capturarAislado();
        assertThat(r.accion()).isEqualTo(TipoActividad.LOGIN);
        assertThat(r.resultado()).isEqualTo(ResultadoActividad.FALLO);
        assertThat(r.emailIntento()).isEqualTo("don@test.com");
        assertThat(r.entidadId()).isEqualTo(5L);
        assertThat(r.toString()).doesNotContain("wrong-password-123");
        assertThat(r.detalle()).doesNotContain("wrong-password-123");
        verify(actividadService, never()).registrar(any());
    }

    @Test
    void login_unknownEmail_recordsFailure() {
        when(usuarioRepository.findByEmail("nadie@test.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new org.example.auth.dto.LoginRequest("nadie@test.com", "whatever-123456")))
                .isInstanceOf(ResponseStatusException.class);

        ActividadService.Registro r = capturarAislado();
        assertThat(r.accion()).isEqualTo(TipoActividad.LOGIN);
        assertThat(r.resultado()).isEqualTo(ResultadoActividad.FALLO);
        assertThat(r.entidadId()).isNull();
    }

    @Test
    void login_inactiveUser_recordsFailureNamingTheReason() {
        Donante u = new Donante(5L, "Don", "don@test.com", passwordEncoder.encode("correct-horse-battery-staple"), false);
        when(usuarioRepository.findByEmail("don@test.com")).thenReturn(Optional.of(u));

        assertThatThrownBy(() -> authService.login(new org.example.auth.dto.LoginRequest("don@test.com", "correct-horse-battery-staple")))
                .isInstanceOf(ResponseStatusException.class);

        ActividadService.Registro r = capturarAislado();
        assertThat(r.resultado()).isEqualTo(ResultadoActividad.FALLO);
        assertThat(r.detalle()).contains("USUARIO_INACTIVO");
    }

    @Test
    void login_success_recordsLoginWithTheUserAsActor() {
        Donante u = new Donante(5L, "Don", "don@test.com", passwordEncoder.encode("correct-horse-battery-staple"), true);
        when(usuarioRepository.findByEmail("don@test.com")).thenReturn(Optional.of(u));
        when(jwtService.generateAccessToken(any())).thenReturn("access-token");
        when(refreshTokenService.issue(any())).thenReturn("refresh-token");

        authService.login(new org.example.auth.dto.LoginRequest("don@test.com", "correct-horse-battery-staple"));

        ActividadService.Registro r = capturarAislado();
        assertThat(r.accion()).isEqualTo(TipoActividad.LOGIN);
        assertThat(r.resultado()).isEqualTo(ResultadoActividad.EXITO);
        assertThat(r.actorId()).isEqualTo(5L);
        assertThat(r.actorTipo()).isEqualTo(TipoActor.DONANTE);
        assertThat(r.emailIntento()).isNull();
    }

    @Test
    void verifyOtp_lockout_recordsOtpBloqueo() {
        Donante u = new Donante(5L, "Don", "don@test.com", "x", true);
        when(usuarioRepository.findByEmail("don@test.com")).thenReturn(Optional.of(u));
        doThrow(new ResponseStatusException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS, "DEMASIADOS_INTENTOS"))
                .when(otpService).verify("don@test.com", "000000");

        assertThatThrownBy(() -> authService.verifyOtp(new VerifyOtpRequest("don@test.com", "000000")))
                .isInstanceOf(ResponseStatusException.class);

        ActividadService.Registro r = capturarAislado();
        assertThat(r.accion()).isEqualTo(TipoActividad.OTP_BLOQUEO);
        assertThat(r.resultado()).isEqualTo(ResultadoActividad.FALLO);
        assertThat(r.detalle()).doesNotContain("000000");
    }
}
