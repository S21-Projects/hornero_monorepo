package org.example.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.example.user.Usuario;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class JwtService {

    private static final String CLAIM_TYPE = "type";
    private static final String TYPE_ACCESS = "access";
    private static final String TYPE_REFRESH = "refresh";

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.expiration-access}")
    private long expirationAccess;

    @Value("${app.jwt.expiration-refresh}")
    private long expirationRefresh;

    private static final int MIN_SECRET_BYTES = 32; // HS256 minimum key size

    /** Fails startup on a missing or too-short secret instead of signing with a weak key. */
    @PostConstruct
    void validateSecret() {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "JWT_SECRET is not set. Provide a random secret of at least " + MIN_SECRET_BYTES + " bytes.");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "JWT_SECRET is too short: HS256 requires at least " + MIN_SECRET_BYTES + " bytes.");
        }
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(Usuario usuario) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("email", usuario.getEmail());
        claims.put("nombre", usuario.getNombre());
        claims.put(CLAIM_TYPE, TYPE_ACCESS);
        claims.put("tipo", resolveDiscriminatorValue(usuario));
        claims.put("emailVerificado", usuario.isEmailVerificado());

        return Jwts.builder()
                .claims(claims)
                .subject(String.valueOf(usuario.getId()))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationAccess))
                .signWith(getSigningKey())
                .compact();
    }

    public String generateRefreshToken(Long userId, String jti) {
        Map<String, Object> claims = new HashMap<>();
        claims.put(CLAIM_TYPE, TYPE_REFRESH);

        return Jwts.builder()
                .claims(claims)
                .id(jti)
                .subject(String.valueOf(userId))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationRefresh))
                .signWith(getSigningKey())
                .compact();
    }

    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Long extractUserId(String token) {
        String subject = extractAllClaims(token).getSubject();
        return Long.parseLong(subject);
    }

    /** The token id, or null when the token carries none (tokens issued before S3). */
    public String extractJti(String token) {
        return extractAllClaims(token).getId();
    }

    public String extractTipo(String token) {
        return extractAllClaims(token).get("tipo", String.class);
    }

    public boolean isTokenValid(String token) {
        try {
            Claims claims = extractAllClaims(token);
            return !claims.getExpiration().before(new Date());
        } catch (Exception e) {
            log.warn("Invalid JWT token: {}", e.getMessage());
            return false;
        }
    }

    public boolean isAccessToken(String token) {
        return isTokenValid(token) && TYPE_ACCESS.equals(extractType(token));
    }

    public boolean isRefreshToken(String token) {
        return isTokenValid(token) && TYPE_REFRESH.equals(extractType(token));
    }

    private String extractType(String token) {
        return extractAllClaims(token).get(CLAIM_TYPE, String.class);
    }

    private String resolveDiscriminatorValue(Usuario usuario) {
        jakarta.persistence.DiscriminatorValue annotation =
                usuario.getClass().getAnnotation(jakarta.persistence.DiscriminatorValue.class);
        if (annotation != null) {
            return annotation.value();
        }
        return usuario.getClass().getSimpleName().toUpperCase();
    }
}
