package org.example.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class ApplicationConfigPasswordEncoderTest {

    private final BCryptPasswordEncoder encoder = new ApplicationConfig().passwordEncoder();

    @Test
    void newHashesUseCost12() {
        assertThat(encoder.encode("Clave-Segura-123")).startsWith("$2a$12$");
    }

    @Test
    void existingCost10HashesStillVerify() {
        String legacyHash = new BCryptPasswordEncoder(10).encode("Clave-Segura-123");

        assertThat(legacyHash).startsWith("$2a$10$");
        assertThat(encoder.matches("Clave-Segura-123", legacyHash)).isTrue();
        assertThat(encoder.matches("otra-clave", legacyHash)).isFalse();
    }
}
