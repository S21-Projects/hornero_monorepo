package org.example.auth.reset;

import lombok.extern.slf4j.Slf4j;
import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.TipoActividad;
import org.example.auth.PasswordPolicy;
import org.example.auth.RefreshTokenService;
import org.example.mail.Mailer;
import org.example.mail.MailerConfig;
import org.example.mail.MensajeCorreo;
import org.example.mail.PasswordCambiadaEmailTemplate;
import org.example.mail.PasswordResetEmailTemplate;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.concurrent.Executor;

/**
 * Forgot-password flow following the OWASP Forgot Password Cheat Sheet.
 *
 * <ul>
 *   <li><b>No enumeration.</b> {@link #solicitar} never reveals whether the email exists or is
 *       active: it always returns normally. Mail is sent off the request thread, and an unknown
 *       email still generates and hashes a token, so the response time does not depend on the
 *       provider round-trip. The one residual difference (a local insert for real users) is a few
 *       milliseconds, far below network jitter, and the BFF rate-limits the route per IP.</li>
 *   <li><b>Token.</b> 32 bytes from {@link SecureRandom}, URL-safe Base64 (256 bits of entropy).
 *       Only its SHA-256 is stored: the token is high-entropy and short-lived, so a slow hash
 *       (BCrypt) adds nothing against offline guessing, and a fast hash lets the lookup be a plain
 *       indexed equality (no timing side channel on a secret compare).</li>
 *   <li><b>Single use, 30 min.</b> Consumed through an atomic conditional update (a concurrent
 *       double submit has exactly one winner). A new request or a completed reset voids every
 *       other pending link of the user.</li>
 *   <li><b>Link base.</b> Built from configuration ({@code app.panel-url}), never from the
 *       request's Host/Origin headers (host-header poisoning).</li>
 *   <li><b>Aftermath.</b> New password under {@link PasswordPolicy}, every refresh-token family
 *       revoked, a confirmation email, and activity records. The reset also marks the email as
 *       verified: following the link proves control of the inbox, the same evidence the OTP
 *       provides.</li>
 * </ul>
 */
@Slf4j
@Service
public class PasswordResetService {

    static final String TOKEN_INVALIDO = "TOKEN_INVALIDO";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32;

    private final UsuarioRepository usuarioRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final PasswordPolicy passwordPolicy;
    private final RefreshTokenService refreshTokenService;
    private final ActividadService actividadService;
    private final Mailer mailer;
    private final Clock clock;
    private final Executor mailExecutor;
    private final TransactionTemplate tx;
    private final long ttlMinutos;
    private final String panelUrl;

    public PasswordResetService(
            UsuarioRepository usuarioRepository,
            PasswordResetTokenRepository tokenRepository,
            BCryptPasswordEncoder passwordEncoder,
            PasswordPolicy passwordPolicy,
            RefreshTokenService refreshTokenService,
            ActividadService actividadService,
            Mailer mailer,
            Clock clock,
            @Qualifier("mailExecutor") Executor mailExecutor,
            PlatformTransactionManager transactionManager,
            @Value("${app.password-reset.ttl-minutos:30}") long ttlMinutos,
            @Value("${app.panel-url:http://localhost:5173}") String panelUrl) {
        this.usuarioRepository = usuarioRepository;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.passwordPolicy = passwordPolicy;
        this.refreshTokenService = refreshTokenService;
        this.actividadService = actividadService;
        this.mailer = mailer;
        this.clock = clock;
        this.mailExecutor = mailExecutor;
        this.tx = new TransactionTemplate(transactionManager);
        this.ttlMinutos = ttlMinutos;
        this.panelUrl = panelUrl.endsWith("/") ? panelUrl.substring(0, panelUrl.length() - 1) : panelUrl;
    }

    /** Always returns normally, whatever the email. */
    public void solicitar(String email) {
        Optional<Usuario> encontrado = usuarioRepository.findByEmail(email);
        String token = nuevoToken();
        String tokenHash = hash(token);   // computed for unknown emails too (see class comment)

        if (encontrado.isEmpty() || !encontrado.get().isActivo()) {
            String motivo = encontrado.isEmpty() ? "USUARIO_DESCONOCIDO" : "USUARIO_INACTIVO";
            actividadService.registrarAislado(Registro.de(TipoActividad.PASSWORD_RESET_SOLICITADO).fallo()
                    .entidad(encontrado.isPresent() ? "USUARIO" : null,
                            encontrado.map(Usuario::getId).orElse(null))
                    .detalle(motivo)
                    .emailIntento(email));
            return;
        }

        Usuario usuario = encontrado.get();
        Instant ahora = clock.instant();
        tx.executeWithoutResult(status -> {
            tokenRepository.invalidarPendientes(usuario.getId(), ahora);
            PasswordResetToken fila = new PasswordResetToken();
            fila.setUsuarioId(usuario.getId());
            fila.setTokenHash(tokenHash);
            fila.setCreadoEn(ahora);
            fila.setExpiraEn(ahora.plusSeconds(ttlMinutos * 60));
            tokenRepository.save(fila);
        });

        actividadService.registrarAislado(Registro.de(TipoActividad.PASSWORD_RESET_SOLICITADO)
                .actor(usuario).entidad("USUARIO", usuario.getId()));

        String enlace = panelUrl + "/restablecer?token=" + token;
        enviar(PasswordResetEmailTemplate.mensaje(usuario.getEmail(), enlace, ttlMinutos));
    }

    public void restablecer(String token, String password) {
        Instant ahora = clock.instant();
        Usuario usuario = tx.execute(status -> aplicar(token, password, ahora));
        enviar(PasswordCambiadaEmailTemplate.mensaje(usuario.getEmail()));
    }

    private Usuario aplicar(String token, String password, Instant ahora) {
        PasswordResetToken fila = tokenRepository.findByTokenHash(hash(token))
                .orElseThrow(() -> rechazado(null, "TOKEN_DESCONOCIDO"));
        if (fila.getUsadoEn() != null) {
            throw rechazado(fila.getUsuarioId(), "TOKEN_USADO");
        }
        if (!fila.getExpiraEn().isAfter(ahora)) {
            throw rechazado(fila.getUsuarioId(), "TOKEN_VENCIDO");
        }
        Usuario usuario = usuarioRepository.findById(fila.getUsuarioId())
                .orElseThrow(() -> rechazado(fila.getUsuarioId(), "USUARIO_DESCONOCIDO"));
        if (!usuario.isActivo()) {
            throw rechazado(usuario.getId(), "USUARIO_INACTIVO");
        }

        // The policy runs before the token is consumed: a weak password must not burn the link.
        try {
            passwordPolicy.validate(password, usuario.getEmail(), usuario.getNombre());
        } catch (ResponseStatusException e) {
            actividadService.registrarAislado(Registro.de(TipoActividad.PASSWORD_RESET_FALLIDO).fallo()
                    .entidad("USUARIO", usuario.getId()).detalle(e.getReason()));
            throw e;
        }

        if (tokenRepository.marcarUsado(fila.getId(), ahora) != 1) {
            throw rechazado(usuario.getId(), "TOKEN_USADO");   // lost a concurrent double submit
        }

        usuario.setPassword(passwordEncoder.encode(password));
        usuario.setEmailVerificado(true);
        usuarioRepository.save(usuario);
        tokenRepository.invalidarPendientes(usuario.getId(), ahora);
        refreshTokenService.revokeAllFor(usuario.getId());

        actividadService.registrar(Registro.de(TipoActividad.PASSWORD_RESET_COMPLETADO)
                .actor(usuario).entidad("USUARIO", usuario.getId()));
        return usuario;
    }

    /** Daily cleanup of links that expired more than one day ago (used links expire like any other). */
    @Scheduled(cron = "${app.password-reset.limpieza-cron:0 45 3 * * *}")
    public void purgeExpired() {
        int borrados = tokenRepository.deleteExpiredBefore(clock.instant().minus(Duration.ofDays(1)));
        if (borrados > 0) {
            log.info("[auth] purged {} expired password reset tokens", borrados);
        }
    }

    /** Failure row survives the rollback (isolated write); the client only ever sees TOKEN_INVALIDO. */
    private ResponseStatusException rechazado(Long usuarioId, String motivo) {
        actividadService.registrarAislado(Registro.de(TipoActividad.PASSWORD_RESET_FALLIDO).fallo()
                .entidad(usuarioId != null ? "USUARIO" : null, usuarioId)
                .detalle(motivo));
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, TOKEN_INVALIDO);
    }

    private void enviar(MensajeCorreo mensaje) {
        mailExecutor.execute(() -> {
            try {
                mailer.enviar(mensaje);
            } catch (Exception e) {
                // Never include the message: it may carry the reset link.
                log.error("[mail] Fallo al enviar '{}' a {}: {}", mensaje.subject(),
                        MailerConfig.enmascarar(mensaje.to()), e.getClass().getSimpleName());
            }
        });
    }

    private static String nuevoToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
