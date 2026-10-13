package org.example.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.auth.dto.AuthResponse;
import org.example.auth.dto.LoginRequest;
import org.example.auth.dto.PasswordOlvidoRequest;
import org.example.auth.dto.PasswordRestablecerRequest;
import org.example.auth.dto.RefreshRequest;
import org.example.auth.dto.RegisterRequest;
import org.example.auth.dto.ResendOtpRequest;
import org.example.auth.dto.UserResponse;
import org.example.auth.dto.VerifyOtpRequest;
import org.example.auth.reset.PasswordResetService;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Tag(name = "Auth", description = "Authentication and token management")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UsuarioRepository usuarioRepository;
    private final PasswordResetService passwordResetService;

    @Operation(summary = "Register a new referente or donante account")
    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @Operation(summary = "Login with credentials and obtain JWT tokens")
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @Operation(summary = "Refresh access token using a valid refresh token")
    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return authService.refresh(request.getRefreshToken());
    }

    @Operation(summary = "Revoke the session of a refresh token (always 204, no oracle)")
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody RefreshRequest request) {
        authService.logout(request.getRefreshToken());
    }

    @Operation(summary = "Confirm an OTP and mark the account as email-verified")
    @PostMapping("/verify-otp")
    public AuthResponse verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        return authService.verifyOtp(request);
    }

    @Operation(summary = "Resend a fresh OTP (always 204, no enumeration oracle)")
    @PostMapping("/resend-otp")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resendOtp(@Valid @RequestBody ResendOtpRequest request) {
        authService.resendOtp(request);
    }

    @Operation(summary = "Request a password reset link (always 202 with the same body, no enumeration oracle)")
    @PostMapping("/password/olvido")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public java.util.Map<String, String> passwordOlvido(@Valid @RequestBody PasswordOlvidoRequest request) {
        passwordResetService.solicitar(request.getEmail());
        return java.util.Map.of("mensaje", "Si el email está registrado, te enviamos un enlace");
    }

    @Operation(summary = "Set a new password with a single-use reset token (400 TOKEN_INVALIDO otherwise)")
    @PostMapping("/password/restablecer")
    public java.util.Map<String, String> passwordRestablecer(@Valid @RequestBody PasswordRestablecerRequest request) {
        passwordResetService.restablecer(request.getToken(), request.getPassword());
        return java.util.Map.of("mensaje", "Contraseña actualizada");
    }

    @Operation(summary = "Get the currently authenticated user's profile")
    @GetMapping("/me")
    public UserResponse me(jakarta.servlet.http.HttpServletRequest request) {
        if (org.example.config.UsuarioInactivo.isMarked(request)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, org.example.config.UsuarioInactivo.CODE);
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof Long)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }

        Long userId = (Long) authentication.getPrincipal();
        Usuario usuario = usuarioRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));

        jakarta.persistence.DiscriminatorValue annotation =
                usuario.getClass().getAnnotation(jakarta.persistence.DiscriminatorValue.class);
        String tipo = annotation != null ? annotation.value() : usuario.getClass().getSimpleName().toUpperCase();

        return new UserResponse(usuario.getId(), usuario.getNombre(), usuario.getEmail(), tipo, usuario.isEmailVerificado());
    }
}
