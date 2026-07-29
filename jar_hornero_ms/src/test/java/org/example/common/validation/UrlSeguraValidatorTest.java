package org.example.common.validation;

import jakarta.validation.ConstraintValidatorContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class UrlSeguraValidatorTest {

    private final UrlSeguraValidator validator = new UrlSeguraValidator();
    private final ConstraintValidatorContext context = null; // unused by this validator

    @Test
    void nullValue_isValid_fieldOmitted() {
        assertThat(validator.isValid(null, context)).isTrue();
    }

    @Test
    void emptyString_isValid_clearSentinel() {
        assertThat(validator.isValid("", context)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {" ", "   ", "\t"})
    void whitespaceOnly_isInvalid(String value) {
        assertThat(validator.isValid(value, context)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "javascript:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "file:///etc/passwd",
            "mailto:test@example.org",
            "//evil.example.org",
            "ftp://example.org"
    })
    void nonHttpScheme_isInvalid(String value) {
        assertThat(validator.isValid(value, context)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://example.org", "https://example.org", "HTTPS://Example.Org/path?x=1"})
    void httpOrHttps_isValid(String value) {
        assertThat(validator.isValid(value, context)).isTrue();
    }

    @Test
    void tooLong_isInvalid() {
        String value = "https://example.org/" + "a".repeat(500);
        assertThat(validator.isValid(value, context)).isFalse();
    }

    @Test
    void absoluteUrlWithoutHost_isInvalid() {
        assertThat(validator.isValid("http:///path", context)).isFalse();
    }
}
