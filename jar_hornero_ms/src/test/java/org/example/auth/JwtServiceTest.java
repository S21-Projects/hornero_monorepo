package org.example.auth;

import org.example.user.Donante;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secret", "test-hornero-secret-must-be-at-least-32-chars");
        ReflectionTestUtils.setField(jwtService, "expirationAccess", 900_000L);
        ReflectionTestUtils.setField(jwtService, "expirationRefresh", 604_800_000L);
    }

    private String accessToken() {
        return jwtService.generateAccessToken(new Donante(1L, "Don", "don@test.com", "encoded", true));
    }

    @Test
    void accessToken_isAccessAndNotRefresh() {
        String token = accessToken();

        assertThat(jwtService.isAccessToken(token)).isTrue();
        assertThat(jwtService.isRefreshToken(token)).isFalse();
    }

    @Test
    void refreshToken_isRefreshAndNotAccess() {
        String token = jwtService.generateRefreshToken(1L, "jti-1");

        assertThat(jwtService.isRefreshToken(token)).isTrue();
        assertThat(jwtService.isAccessToken(token)).isFalse();
    }

    @Test
    void refreshToken_carriesItsJti() {
        String token = jwtService.generateRefreshToken(1L, "jti-1");

        assertThat(jwtService.extractJti(token)).isEqualTo("jti-1");
    }

    @Test
    void garbageToken_isNeitherAccessNorRefresh() {
        assertThat(jwtService.isAccessToken("not-a-jwt")).isFalse();
        assertThat(jwtService.isRefreshToken("not-a-jwt")).isFalse();
    }
}
