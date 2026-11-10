package org.example.auth;

import lombok.extern.slf4j.Slf4j;
import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.TipoActividad;
import org.example.user.Usuario;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Refresh-token persistence with rotation and reuse detection. Each refresh marks the presented
 * token as rotated and issues a successor in the same family. Replaying a rotated token outside
 * the grace window (concurrent tabs share cookies) is treated as theft and revokes the family.
 */
@Service
@Slf4j
public class RefreshTokenService {

    private static final String INVALID = "Refresh token expirado o inválido";

    private final RefreshTokenRepository repository;
    private final JwtService jwtService;
    private final Clock clock;
    private final long refreshTtlMillis;
    private final long reuseGraceSeconds;
    private final ActividadService actividadService;

    public RefreshTokenService(
            RefreshTokenRepository repository,
            JwtService jwtService,
            Clock clock,
            @Value("${app.jwt.expiration-refresh}") long refreshTtlMillis,
            @Value("${app.jwt.refresh-reuse-grace-seconds:30}") long reuseGraceSeconds,
            ActividadService actividadService) {
        this.repository = repository;
        this.jwtService = jwtService;
        this.clock = clock;
        this.refreshTtlMillis = refreshTtlMillis;
        this.reuseGraceSeconds = reuseGraceSeconds;
        this.actividadService = actividadService;
    }

    /** Starts a new family (login, register, OTP verification) and returns the signed token. */
    @Transactional
    public String issue(Usuario usuario) {
        return create(usuario.getId(), UUID.randomUUID().toString());
    }

    /**
     * Rotates the token identified by {@code jti}. A rejected replay commits the family
     * revocation, hence {@code noRollbackFor}.
     */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public String rotate(String jti, Usuario usuario) {
        RefreshToken current = repository.findByJti(jti).orElseThrow(() -> rechazado(usuario, "TOKEN_DESCONOCIDO"));
        if (current.getRevokedAt() != null || !current.getUsuarioId().equals(usuario.getId())) {
            throw rechazado(usuario, "TOKEN_REVOCADO");
        }

        Instant now = clock.instant();
        if (current.getRotatedAt() == null) {
            current.setRotatedAt(now);
            repository.save(current);
        } else if (now.isBefore(current.getRotatedAt().plusSeconds(reuseGraceSeconds))) {
            log.debug("[auth] concurrent refresh within grace for user {}", usuario.getId());
        } else {
            repository.revokeFamily(current.getFamilyId(), now);
            log.warn("[auth] refresh token reuse detected for user {}: family revoked", usuario.getId());
            // ASVS 16.3.3 (bypass attempt). Isolated: the caller's transaction ends in an exception.
            actividadService.registrarAislado(Registro.de(TipoActividad.REFRESH_TOKEN_REUTILIZADO).fallo()
                    .actor(usuario).entidad("USUARIO", usuario.getId())
                    .detalle("familia revocada"));
            throw unauthorized();
        }
        return create(usuario.getId(), current.getFamilyId());
    }

    /** Revokes the family of {@code jti}; unknown tokens are ignored (no oracle). */
    @Transactional
    public void revokeFamilyOf(String jti) {
        repository.findByJti(jti)
                .ifPresent(t -> repository.revokeFamily(t.getFamilyId(), clock.instant()));
    }

    @Transactional
    public void revokeAllFor(Long usuarioId) {
        repository.revokeAllByUsuarioId(usuarioId, clock.instant());
    }

    /** Daily cleanup of tokens that expired more than one day ago. */
    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void purgeExpired() {
        int deleted = repository.deleteExpiredBefore(clock.instant().minus(Duration.ofDays(1)));
        if (deleted > 0) {
            log.info("[auth] purged {} expired refresh tokens", deleted);
            actividadService.registrar(Registro.de(TipoActividad.TOKENS_PURGADOS).sistema()
                    .detalle(deleted + " refresh tokens vencidos"));
        }
    }

    private String create(Long usuarioId, String familyId) {
        Instant now = clock.instant();
        String jti = UUID.randomUUID().toString();

        RefreshToken row = new RefreshToken();
        row.setJti(jti);
        row.setUsuarioId(usuarioId);
        row.setFamilyId(familyId);
        row.setIssuedAt(now);
        row.setExpiresAt(now.plusMillis(refreshTtlMillis));
        repository.save(row);

        return jwtService.generateRefreshToken(usuarioId, jti);
    }

    private ResponseStatusException rechazado(Usuario usuario, String motivo) {
        actividadService.registrarAislado(Registro.de(TipoActividad.REFRESH_TOKEN).fallo()
                .entidad("USUARIO", usuario.getId()).detalle(motivo));
        return unauthorized();
    }

    private ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, INVALID);
    }
}
