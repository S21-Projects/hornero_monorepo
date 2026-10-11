package org.example.config;

import java.util.List;
import java.util.stream.Collectors;
import jakarta.persistence.OptimisticLockException;
import org.example.common.ApiResponse;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

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

    /**
     * Without this, an {@code @PreAuthorize}-denied method-security failure (thrown from inside
     * the controller invocation, so it never reaches {@code SecurityConfig}'s
     * {@code ExceptionTranslationFilter}) fell into the generic {@code Exception} handler below
     * and answered 500 instead of 403 — discovered by
     * {@code AcreditacionControllerSecurityTest}, but a latent gap for every existing
     * {@code @PreAuthorize} annotation in the app, not something new this change introduces.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex,
                                                                 jakarta.servlet.http.HttpServletRequest request) {
        if (UsuarioInactivo.isMarked(request)) {
            // N9: the denial is really "your account was deactivated", not a role problem.
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error(401, UsuarioInactivo.CODE, List.of(UsuarioInactivo.CODE)));
        }
        String message = "Acceso denegado";
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(HttpStatus.FORBIDDEN.value(), message, List.of(message)));
    }

    /**
     * A request to a retired/never-mapped route (e.g. the retired `confirmar-entrega` endpoint,
     * spec `donacion-entrega-codigo`'s "Old confirm endpoint no longer exists") falls through to
     * Spring's static-resource handler, which throws this instead of a 404
     * {@code NoHandlerFoundException} once `DispatcherServlet` has a handler mapping for static
     * resources (the default in a Spring Boot web app). Without this case it fell into the
     * generic {@code Exception} handler below and answered 500 instead of 404.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFound(NoResourceFoundException ex) {
        String message = "Not found";
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(HttpStatus.NOT_FOUND.value(), message, List.of(message)));
    }

    /**
     * N11: {@code @Version} on Donacion, Necesidad and Organizacion. Two concurrent operations on
     * the same row: the first commit wins, the second one fails here and the client should reload
     * and decide again.
     */
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ApiResponse<Void>> handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
        return conflictoConcurrente();
    }

    @ExceptionHandler(OptimisticLockException.class)
    public ResponseEntity<ApiResponse<Void>> handleOptimisticLockJpa(OptimisticLockException ex) {
        return conflictoConcurrente();
    }

    /**
     * A constraint violation that no service translated (e.g. a race on a unique column). The
     * detail (constraint and SQL) is logged here and never echoed to the client.
     * {@code IdempotenciaService} catches its own violation before it can reach this handler.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation", ex);
        String code = "CONFLICTO_DATOS";
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(HttpStatus.CONFLICT.value(), code, List.of(code)));
    }

    private static ResponseEntity<ApiResponse<Void>> conflictoConcurrente() {
        String code = "CONFLICTO_CONCURRENTE";
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(HttpStatus.CONFLICT.value(), code, List.of(code)));
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
