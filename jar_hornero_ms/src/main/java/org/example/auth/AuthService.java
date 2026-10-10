package org.example.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.auth.dto.AuthResponse;
import org.example.auth.dto.LoginRequest;
import org.example.auth.dto.RegisterRequest;
import org.example.auth.dto.ResendOtpRequest;
import org.example.auth.dto.UserResponse;
import org.example.auth.dto.VerifyOtpRequest;
import org.example.auth.otp.OtpService;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final JwtService jwtService;
    private final BCryptPasswordEncoder passwordEncoder;
    private final OtpService otpService;
    private final RefreshTokenService refreshTokenService;

    public AuthResponse login(LoginRequest request) {
        Usuario usuario = usuarioRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Credenciales inválidas"));

        if (!usuario.isActivo()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas");
        }

        if (!passwordEncoder.matches(request.getPassword(), usuario.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas");
        }

        String accessToken = jwtService.generateAccessToken(usuario);
        String refreshToken = refreshTokenService.issue(usuario);

        return new AuthResponse(accessToken, refreshToken, toUserResponse(usuario));
    }

    public AuthResponse refresh(String refreshToken) {
        if (!jwtService.isRefreshToken(refreshToken)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expirado o inválido");
        }

        String jti = jwtService.extractJti(refreshToken);
        if (jti == null) {
            // Issued before refresh tokens were persisted: cannot be tracked, force a new login.
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expirado o inválido");
        }

        Long userId = jwtService.extractUserId(refreshToken);
        Usuario usuario = usuarioRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));

        if (!usuario.isActivo()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario inactivo");
        }

        String newRefreshToken = refreshTokenService.rotate(jti, usuario);
        String newAccessToken = jwtService.generateAccessToken(usuario);

        return new AuthResponse(newAccessToken, newRefreshToken, toUserResponse(usuario));
    }

    /** Revokes the token's family. Never fails and never reveals whether the token was valid. */
    public void logout(String refreshToken) {
        try {
            if (jwtService.isRefreshToken(refreshToken)) {
                String jti = jwtService.extractJti(refreshToken);
                if (jti != null) {
                    refreshTokenService.revokeFamilyOf(jti);
                }
            }
        } catch (RuntimeException e) {
            log.warn("[auth] logout could not revoke token: {}", e.getMessage());
        }
    }

    public AuthResponse register(RegisterRequest request) {
        if (usuarioRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El email ya está registrado");
        }

        String encodedPassword = passwordEncoder.encode(request.getPassword());
        String tipo = request.getTipo();

        Usuario usuario;
        if ("DONANTE".equalsIgnoreCase(tipo)) {
            usuario = new Donante(null, request.getNombre(), request.getEmail(), encodedPassword, true);
        } else {
            // Default to REFERENTE; ADMINISTRADOR is never allowed via public registration
            usuario = new Referente(null, request.getNombre(), request.getEmail(), encodedPassword, true);
        }

        usuario = usuarioRepository.save(usuario);

        try {
            otpService.issue(usuario.getEmail());
        } catch (Exception e) {
            // Mail dispatch failure must never block registration or token issuance.
            log.error("[otp] Fallo al emitir el código de verificación para {}: {}", usuario.getEmail(), e.getMessage());
        }

        String accessToken = jwtService.generateAccessToken(usuario);
        String refreshToken = refreshTokenService.issue(usuario);

        return new AuthResponse(accessToken, refreshToken, toUserResponse(usuario));
    }

    public AuthResponse verifyOtp(VerifyOtpRequest request) {
        Usuario usuario = usuarioRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "CODIGO_INVALIDO"));

        otpService.verify(request.getEmail(), request.getCodigo());

        usuario.setEmailVerificado(true);
        usuario = usuarioRepository.save(usuario);

        String accessToken = jwtService.generateAccessToken(usuario);
        String refreshToken = refreshTokenService.issue(usuario);

        return new AuthResponse(accessToken, refreshToken, toUserResponse(usuario));
    }

    public void resendOtp(ResendOtpRequest request) {
        // Always attempt the same flow regardless of whether the email exists —
        // no enumeration oracle. The throttle is still enforced per email.
        if (usuarioRepository.findByEmail(request.getEmail()).isEmpty()) {
            return;
        }
        otpService.resend(request.getEmail());
    }

    private UserResponse toUserResponse(Usuario usuario) {
        jakarta.persistence.DiscriminatorValue annotation =
                usuario.getClass().getAnnotation(jakarta.persistence.DiscriminatorValue.class);
        String tipo = annotation != null ? annotation.value() : usuario.getClass().getSimpleName().toUpperCase();
        return new UserResponse(usuario.getId(), usuario.getNombre(), usuario.getEmail(), tipo, usuario.isEmailVerificado());
    }
}
