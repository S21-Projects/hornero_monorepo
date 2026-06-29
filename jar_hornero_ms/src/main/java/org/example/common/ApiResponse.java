package org.example.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

/**
 * Global response envelope for all MS HTTP responses.
 * Use {@link #ok(int, Object)} for success and {@link #error(int, String, List)} for errors.
 * Controllers never build this directly — {@link ApiResponseAdvice} wraps them automatically.
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record ApiResponse<T>(
        int status,
        String message,
        Instant timestamp,
        T data,
        List<String> errors
) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(200, "Success", Instant.now(), data, null);
    }

    public static <T> ApiResponse<T> ok(int status, T data) {
        return new ApiResponse<>(status, "Success", Instant.now(), data, null);
    }

    public static ApiResponse<Void> error(int status, String message, List<String> errors) {
        return new ApiResponse<>(status, message, Instant.now(), null, errors);
    }
}
