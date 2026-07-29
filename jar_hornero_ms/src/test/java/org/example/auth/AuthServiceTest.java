package org.example.auth;

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

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(usuarioRepository, jwtService, passwordEncoder, otpService);
    }

    // --- register: HIGH PRIORITY risk area (mail dispatch failure must not block registration) ---

    @Test
    void register_otpIssueThrows_stillPersistsUserAndIssuesTokens() {
        RegisterRequest request = new RegisterRequest("Donante Test", "donante@test.com", "password123", "DONANTE");

        when(usuarioRepository.findByEmail("donante@test.com")).thenReturn(Optional.empty());
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(inv -> {
            Usuario u = inv.getArgument(0);
            u.setId(1L);
            return u;
        });
        doThrow(new RuntimeException("resend down")).when(otpService).issue("donante@test.com");
        when(jwtService.generateAccessToken(any())).thenReturn("access-token");
        when(jwtService.generateRefreshToken(1L)).thenReturn("refresh-token");

        assertThatCode(() -> {
            var response = authService.register(request);
            assertThat(response.getAccessToken()).isEqualTo("access-token");
            assertThat(response.getRefreshToken()).isEqualTo("refresh-token");
        }).doesNotThrowAnyException();

        verify(usuarioRepository, times(1)).save(any(Usuario.class));
    }

    @Test
    void register_newUser_startsUnverifiedAndIssuesOtp() {
        RegisterRequest request = new RegisterRequest("Referente Test", "ref@test.com", "password123", "REFERENTE");

        when(usuarioRepository.findByEmail("ref@test.com")).thenReturn(Optional.empty());
        ArgumentCaptor<Usuario> captor = ArgumentCaptor.forClass(Usuario.class);
        when(usuarioRepository.save(captor.capture())).thenAnswer(inv -> {
            Usuario u = inv.getArgument(0);
            u.setId(2L);
            return u;
        });
        when(jwtService.generateAccessToken(any())).thenReturn("access-token");
        when(jwtService.generateRefreshToken(2L)).thenReturn("refresh-token");

        var response = authService.register(request);

        assertThat(captor.getValue()).isInstanceOf(Referente.class);
        assertThat(captor.getValue().isEmailVerificado()).isFalse();
        assertThat(response.getUser().isEmailVerificado()).isFalse();
        verify(otpService).issue("ref@test.com");
    }

    @Test
    void register_emailAlreadyRegistered_throws409() {
        RegisterRequest request = new RegisterRequest("Test", "dup@test.com", "password123", "DONANTE");
        when(usuarioRepository.findByEmail("dup@test.com")).thenReturn(Optional.of(new Donante()));

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");

        verify(otpService, never()).issue(anyString());
    }

    // --- verifyOtp ---

    @Test
    void verifyOtp_validCode_marksVerifiedAndReissuesTokens() {
        Referente referente = new Referente(3L, "Ref", "ref@test.com", "encoded", true);
        referente.setEmailVerificado(false);

        when(usuarioRepository.findByEmail("ref@test.com")).thenReturn(Optional.of(referente));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jwtService.generateAccessToken(any())).thenReturn("access-token");
        when(jwtService.generateRefreshToken(3L)).thenReturn("refresh-token");

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
}
