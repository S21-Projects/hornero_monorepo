package org.example.common;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * T-MS-23: Fallback Exception handler MUST return a sanitized body.
 *
 * Unit test — invokes GlobalExceptionHandler.handleGeneric() directly with a
 * RuntimeException whose message contains internal detail (simulating a
 * PropertyReferenceException leaking entity field names).
 *
 * RED: fails before the handler is fixed (returns ex.getMessage() verbatim).
 * GREEN: passes after the handler always emits the static "Unexpected error" string.
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void handleGeneric_sanitizesBody_doesNotLeakExceptionMessage() {
        RuntimeException ex = new RuntimeException(
                "No property 'foo' found for type 'org.example.necesidad.Necesidad'");

        ResponseEntity<ApiResponse<Void>> response = handler.handleGeneric(ex);

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().errors())
                .doesNotContain(ex.getMessage())
                .contains("Unexpected error");
    }

    @Test
    void handleGeneric_returnsUnexpectedError_evenWhenMessageIsNull() {
        RuntimeException ex = new RuntimeException((String) null);

        ResponseEntity<ApiResponse<Void>> response = handler.handleGeneric(ex);

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getBody().errors()).containsExactly("Unexpected error");
    }
}
