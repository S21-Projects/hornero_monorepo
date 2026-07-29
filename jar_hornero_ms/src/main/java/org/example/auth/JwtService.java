package org.example.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.example.user.Usuario;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class JwtService {

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.expiration-access}")
    private long expirationAccess;

    @Value("${app.jwt.expiration-refresh}")
    private long expirationRefresh;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(Usuario usuario) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("email", usuario.getEmail());
        claims.put("nombre", usuario.getNombre());
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

    public String generateRefreshToken(Long userId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("type", "refresh");

        return Jwts.builder()
                .claims(claims)
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

    private String resolveDiscriminatorValue(Usuario usuario) {
        jakarta.persistence.DiscriminatorValue annotation =
                usuario.getClass().getAnnotation(jakarta.persistence.DiscriminatorValue.class);
        if (annotation != null) {
            return annotation.value();
        }
        return usuario.getClass().getSimpleName().toUpperCase();
    }
}
