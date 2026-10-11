package org.example.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Refresh-token persistence, rotation, reuse detection and revocation end to end over H2.
 * Uses the seeded admin from DataInitializer; the default 30s reuse grace applies.
 */
@SpringBootTest
@AutoConfigureMockMvc
class RefreshTokenLifecycleIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RefreshTokenRepository repository;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UsuarioRepository usuarioRepository;

    private JsonNode login() throws Exception {
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@hornero.ar\",\"password\":\"Admin123!\"}"))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    private String json(String token) {
        return "{\"refreshToken\":\"" + token + "\"}";
    }

    private int refresh(String token) throws Exception {
        return mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON).content(json(token)))
                .andReturn().getResponse().getStatus();
    }

    private String refreshAndGet(String token) throws Exception {
        String body = mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON).content(json(token)))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("refreshToken").asText();
    }

    private int logout(String token) throws Exception {
        return mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON).content(json(token)))
                .andReturn().getResponse().getStatus();
    }

    private RefreshToken row(String token) {
        return repository.findByJti(jwtService.extractJti(token)).orElseThrow();
    }

    @Test
    void login_persistsTheJtiInANewFamily() throws Exception {
        String a = login().get("refreshToken").asText();
        String b = login().get("refreshToken").asText();

        assertThat(row(a).getFamilyId()).isNotEqualTo(row(b).getFamilyId());
        assertThat(row(a).getRotatedAt()).isNull();
        assertThat(row(a).getRevokedAt()).isNull();
    }

    @Test
    void refresh_rotatesTheTokenAndKeepsTheFamily() throws Exception {
        String first = login().get("refreshToken").asText();

        String second = refreshAndGet(first);

        assertThat(row(first).getRotatedAt()).isNotNull();
        assertThat(row(second).getFamilyId()).isEqualTo(row(first).getFamilyId());
        assertThat(refresh(second)).isEqualTo(200);
    }

    @Test
    void refresh_reuseWithinGrace_stillWorks() throws Exception {
        String first = login().get("refreshToken").asText();
        refreshAndGet(first);

        assertThat(refresh(first)).isEqualTo(200);
    }

    @Test
    void logout_revokesTheFamily_soRefreshFails() throws Exception {
        String first = login().get("refreshToken").asText();
        String second = refreshAndGet(first);

        assertThat(logout(second)).isEqualTo(204);

        assertThat(refresh(second)).isEqualTo(401);
        assertThat(refresh(first)).isEqualTo(401);
    }

    @Test
    void logout_withGarbageToken_isStillNoContent() throws Exception {
        assertThat(logout("not-a-jwt")).isEqualTo(204);
    }

    @Test
    void logout_withAccessToken_isStillNoContent() throws Exception {
        assertThat(logout(login().get("accessToken").asText())).isEqualTo(204);
    }

    @Test
    void deactivatingTheUser_revokesTheirRefreshTokens() throws Exception {
        String token = login().get("refreshToken").asText();
        Usuario admin = usuarioRepository.findByEmail("admin@hornero.ar").orElseThrow();

        refreshTokenService.revokeAllFor(admin.getId());

        assertThat(refresh(token)).isEqualTo(401);
    }

    @Test
    void refreshTokenWithoutJti_isRejected() throws Exception {
        Usuario admin = usuarioRepository.findByEmail("admin@hornero.ar").orElseThrow();
        String legacy = io.jsonwebtoken.Jwts.builder()
                .claim("type", "refresh")
                .subject(String.valueOf(admin.getId()))
                .expiration(java.util.Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
                .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(
                        "test-hornero-secret-must-be-at-least-32-chars".getBytes()))
                .compact();

        assertThat(refresh(legacy)).isEqualTo(401);
    }

    @Test
    void purgeExpired_deletesOnlyRowsExpiredMoreThanADayAgo() {
        Instant now = Instant.now();
        RefreshToken longGone = persist("purge-old", now.minus(2, ChronoUnit.DAYS));
        RefreshToken justExpired = persist("purge-recent", now.minus(1, ChronoUnit.HOURS));
        RefreshToken live = persist("purge-live", now.plus(1, ChronoUnit.DAYS));

        refreshTokenService.purgeExpired();

        assertThat(repository.findByJti(longGone.getJti())).isEmpty();
        assertThat(repository.findByJti(justExpired.getJti())).isPresent();
        assertThat(repository.findByJti(live.getJti())).isPresent();
    }

    private RefreshToken persist(String jti, Instant expiresAt) {
        RefreshToken t = new RefreshToken();
        t.setJti(jti);
        t.setUsuarioId(1L);
        t.setFamilyId("fam-" + jti);
        t.setIssuedAt(expiresAt.minus(7, ChronoUnit.DAYS));
        t.setExpiresAt(expiresAt);
        return repository.save(t);
    }
}
