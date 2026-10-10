package org.example.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

/**
 * N9/D9: marks a request whose access token is valid but belongs to a deactivated user. The
 * {@link JwtAuthFilter} sets the request attribute (and leaves the request unauthenticated, so
 * public GET routes keep serving it as anonymous); the entry point, the access-denied handler and
 * {@code /api/auth/me} turn it into a 401 with the stable code {@link #CODE}.
 */
public final class UsuarioInactivo {

    public static final String CODE = "USUARIO_INACTIVO";
    public static final String REQUEST_ATTRIBUTE = UsuarioInactivo.class.getName() + ".INACTIVO";

    private UsuarioInactivo() {
    }

    public static void mark(HttpServletRequest request) {
        request.setAttribute(REQUEST_ATTRIBUTE, Boolean.TRUE);
    }

    public static boolean isMarked(HttpServletRequest request) {
        return request != null && Boolean.TRUE.equals(request.getAttribute(REQUEST_ATTRIBUTE));
    }

    /** Writes the same envelope shape as {@code ApiResponse.error(401, CODE, [CODE])}. */
    public static void write401(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"status\":401,\"message\":\"" + CODE + "\",\"timestamp\":\""
                + Instant.now() + "\",\"data\":null,\"errors\":[\"" + CODE + "\"]}");
    }
}
