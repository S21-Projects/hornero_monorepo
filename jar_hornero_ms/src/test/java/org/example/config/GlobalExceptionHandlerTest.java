package org.example.config;

import org.example.common.ApiResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * T-MS-23: Fallback Exception handler MUST return a sanitized body.
 *
 * Unit test — invokes GlobalExceptionHandler.handleUnexpected() directly with a
 * RuntimeException whose message contains internal detail (simulating a
 * PropertyReferenceException leaking entity field names).
 *
 * RED: fails before the handler is fixed (returns ex.getMessage() verbatim).
 * GREEN: passes after the handler always emits the static "Error interno del servidor" string.
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void handleUnexpected_sanitizesBody_doesNotLeakExceptionMessage() {
        RuntimeException ex = new RuntimeException(
                "No property 'foo' found for type 'org.example.necesidad.Necesidad'");

        ResponseEntity<ApiResponse<Void>> response = handler.handleUnexpected(ex);

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().errors())
                .doesNotContain(ex.getMessage())
                .contains("Error interno del servidor");
    }

    @Test
    void handleUnexpected_returnsGenericMessage_evenWhenExceptionMessageIsNull() {
        RuntimeException ex = new RuntimeException((String) null);

        ResponseEntity<ApiResponse<Void>> response = handler.handleUnexpected(ex);

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getBody().errors()).containsExactly("Error interno del servidor");
    }
}
