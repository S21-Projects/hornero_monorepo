package org.example.config;

import java.util.List;
import java.util.stream.Collectors;
import org.example.common.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/**
 * Curates what reaches the client now that server.error.include-message=always
 * is on (needed so ResponseStatusException reason codes like
 * EMAIL_NO_VERIFICADO round-trip to the frontend). Without this, any
 * uncaught exception (JPA constraint violations, driver errors, ...) would
 * also echo its raw message via the same setting.
 *
 * MethodArgumentNotValidException gets its own case so @Valid DTO errors
 * keep their existing 400 + field-message shape instead of falling into the
 * generic 500 handler below. All errors always carry the full field-error
 * list in {@code errors[]} in addition to the single {@code message} used by
 * existing clients.
 *
 * Bodies are {@link ApiResponse} so {@code ApiResponseAdvice} recognises them
 * as already-enveloped and skips re-wrapping.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> handleResponseStatus(ResponseStatusException ex) {
        int status = ex.getStatusCode().value();
        String message = ex.getReason() != null ? ex.getReason() : "Error";
        return ResponseEntity.status(status)
                .body(ApiResponse.error(status, message, List.of(message)));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        List<String> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.toList());
        String message = errors.stream().findFirst().orElse("Datos inválidos");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), message, errors));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        String message = "Error interno del servidor";
        return ResponseEntity.internalServerError()
                .body(ApiResponse.error(500, message, List.of(message)));
    }
}
