package org.example.auth;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtSecretValidationTest {

    private static JwtService withSecret(String secret) {
        JwtService service = new JwtService();
        ReflectionTestUtils.setField(service, "secret", secret);
        return service;
    }

    @Test
    void validateSecret_blank_failsNamingJwtSecret() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> withSecret("  ").validateSecret());
        assertTrue(ex.getMessage().contains("JWT_SECRET"));
    }

    @Test
    void validateSecret_null_failsNamingJwtSecret() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> withSecret(null).validateSecret());
        assertTrue(ex.getMessage().contains("JWT_SECRET"));
    }

    @Test
    void validateSecret_shorterThan32Bytes_fails() {
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> withSecret("short-secret-31-bytes-xxxxxxxxx").validateSecret());
        assertTrue(ex.getMessage().contains("JWT_SECRET"));
    }

    @Test
    void validateSecret_32Bytes_passes() {
        assertDoesNotThrow(() -> withSecret("a".repeat(32)).validateSecret());
    }
}
