package org.example.common;

import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

/**
 * Centrally wraps every non-{@link ApiResponse} JSON response body in the envelope.
 *
 * <p>Exemptions:
 * <ul>
 *   <li>{@code /v3/api-docs*} paths — springdoc must return raw OpenAPI JSON.</li>
 *   <li>Bodies already of type {@link ApiResponse} (e.g. from {@link GlobalExceptionHandler}).</li>
 *   <li>Null bodies (e.g. 204 No Content from DELETE endpoints).</li>
 *   <li>Non-JSON converters (e.g. StringHttpMessageConverter) — passed through unchanged.</li>
 * </ul>
 */
@RestControllerAdvice
public class ApiResponseAdvice implements ResponseBodyAdvice<Object> {

    @Override
    public boolean supports(MethodParameter returnType,
                            Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(Object body,
                                  MethodParameter returnType,
                                  MediaType selectedContentType,
                                  Class<? extends HttpMessageConverter<?>> selectedConverterType,
                                  ServerHttpRequest request,
                                  ServerHttpResponse response) {

        // Exempt springdoc OpenAPI paths and auth endpoints — they must return raw JSON
        String path = request.getURI().getPath();
        if (path.startsWith("/v3/api-docs") || path.startsWith("/api/auth/")) {
            return body;
        }

        // Only wrap Jackson-serialised JSON responses
        if (!MappingJackson2HttpMessageConverter.class.isAssignableFrom(selectedConverterType)) {
            return body;
        }

        // Body is already an envelope (e.g. returned by GlobalExceptionHandler)
        if (body instanceof ApiResponse<?>) {
            return body;
        }

        // Null body (204 No Content, etc.)
        if (body == null) {
            return null;
        }

        // Resolve the actual HTTP status from the response so 201 / 200 etc. are reflected
        int statusCode = 200;
        if (response instanceof ServletServerHttpResponse servletResponse) {
            statusCode = servletResponse.getServletResponse().getStatus();
        }

        return ApiResponse.ok(statusCode, body);
    }
}
