package org.example.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.TipoActividad;
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
    private final PasswordPolicy passwordPolicy;
    /** N10: auth events use the isolated (REQUIRES_NEW, never-throwing) write; see ActividadService. */
    private final ActividadService actividadService;

    public AuthResponse login(LoginRequest request) {
        Usuario usuario = usuarioRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> loginFallido(null, request.getEmail(), "USUARIO_DESCONOCIDO"));

        if (!usuario.isActivo()) {
            throw loginFallido(usuario.getId(), request.getEmail(), "USUARIO_INACTIVO");
        }

        if (!passwordEncoder.matches(request.getPassword(), usuario.getPassword())) {
            throw loginFallido(usuario.getId(), request.getEmail(), "CREDENCIALES_INVALIDAS");
        }

        String accessToken = jwtService.generateAccessToken(usuario);
        String refreshToken = refreshTokenService.issue(usuario);

        actividadService.registrarAislado(Registro.de(TipoActividad.LOGIN)
                .actor(usuario).entidad("USUARIO", usuario.getId()));

        return new AuthResponse(accessToken, refreshToken, toUserResponse(usuario));
    }

    public AuthResponse refresh(String refreshToken) {
        if (!jwtService.isRefreshToken(refreshToken)) {
            throw refreshFallido(null, "TOKEN_INVALIDO", "Refresh token expirado o inválido");
        }

        String jti = jwtService.extractJti(refreshToken);
        if (jti == null) {
            // Issued before refresh tokens were persisted: cannot be tracked, force a new login.
            throw refreshFallido(null, "TOKEN_SIN_JTI", "Refresh token expirado o inválido");
        }

        Long userId = jwtService.extractUserId(refreshToken);
        Usuario usuario = usuarioRepository.findById(userId)
                .orElseThrow(() -> refreshFallido(userId, "USUARIO_NO_ENCONTRADO", "Usuario no encontrado"));

        if (!usuario.isActivo()) {
            throw refreshFallido(userId, "USUARIO_INACTIVO", "Usuario inactivo");
        }

        String newRefreshToken = refreshTokenService.rotate(jti, usuario);
        String newAccessToken = jwtService.generateAccessToken(usuario);

        actividadService.registrarAislado(Registro.de(TipoActividad.REFRESH_TOKEN)
                .actor(usuario).entidad("USUARIO", usuario.getId()));

        return new AuthResponse(newAccessToken, newRefreshToken, toUserResponse(usuario));
    }

    /** Revokes the token's family. Never fails and never reveals whether the token was valid. */
    public void logout(String refreshToken) {
        try {
            if (jwtService.isRefreshToken(refreshToken)) {
                String jti = jwtService.extractJti(refreshToken);
                if (jti != null) {
                    refreshTokenService.revokeFamilyOf(jti);
                    Long userId = jwtService.extractUserId(refreshToken);
                    if (userId != null) {
                        Registro registro = Registro.de(TipoActividad.LOGOUT).entidad("USUARIO", userId);
                        usuarioRepository.findById(userId).ifPresent(registro::actor);
                        actividadService.registrarAislado(registro);
                    }
                }
            }
        } catch (RuntimeException e) {
            log.warn("[auth] logout could not revoke token: {}", e.getMessage());
        }
    }

    public AuthResponse register(RegisterRequest request) {
        passwordPolicy.validate(request.getPassword(), request.getEmail(), request.getNombre());

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

        actividadService.registrarAislado(Registro.de(TipoActividad.REGISTRO)
                .actor(usuario).entidad("USUARIO", usuario.getId()));

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
                .orElseThrow(() -> {
                    actividadService.registrarAislado(Registro.de(TipoActividad.OTP_VERIFICACION)
                            .fallo().detalle("USUARIO_DESCONOCIDO"));
                    return new ResponseStatusException(HttpStatus.BAD_REQUEST, "CODIGO_INVALIDO");
                });

        try {
            otpService.verify(request.getEmail(), request.getCodigo());
        } catch (ResponseStatusException e) {
            // 429 = the attempt limit was reached (lockout); anything else is a plain failure.
            boolean bloqueo = e.getStatusCode().value() == HttpStatus.TOO_MANY_REQUESTS.value();
            actividadService.registrarAislado(Registro.de(
                            bloqueo ? TipoActividad.OTP_BLOQUEO : TipoActividad.OTP_VERIFICACION)
                    .fallo().entidad("USUARIO", usuario.getId()).detalle(e.getReason()));
            throw e;
        }

        usuario.setEmailVerificado(true);
        usuario = usuarioRepository.save(usuario);

        actividadService.registrarAislado(Registro.de(TipoActividad.OTP_VERIFICACION)
                .actor(usuario).entidad("USUARIO", usuario.getId()));

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

    /**
     * Records a failed login (the row survives the exception) and returns the generic 401: the
     * client never learns which of the three reasons applied, the admin-only log does.
     */
    private ResponseStatusException loginFallido(Long usuarioId, String email, String motivo) {
        actividadService.registrarAislado(Registro.de(TipoActividad.LOGIN).fallo()
                .entidad(usuarioId != null ? "USUARIO" : null, usuarioId)
                .detalle(motivo)
                .emailIntento(email));
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas");
    }

    private ResponseStatusException refreshFallido(Long usuarioId, String motivo, String mensaje) {
        actividadService.registrarAislado(Registro.de(TipoActividad.REFRESH_TOKEN).fallo()
                .entidad(usuarioId != null ? "USUARIO" : null, usuarioId)
                .detalle(motivo));
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, mensaje);
    }

    private UserResponse toUserResponse(Usuario usuario) {
        jakarta.persistence.DiscriminatorValue annotation =
                usuario.getClass().getAnnotation(jakarta.persistence.DiscriminatorValue.class);
        String tipo = annotation != null ? annotation.value() : usuario.getClass().getSimpleName().toUpperCase();
        return new UserResponse(usuario.getId(), usuario.getNombre(), usuario.getEmail(), tipo, usuario.isEmailVerificado());
    }
}
