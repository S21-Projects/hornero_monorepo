package org.example.idempotencia;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.example.common.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerExecutionChain;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;
import org.springframework.web.util.ServletRequestPathUtils;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/**
 * Enforces {@code Idempotency-Key} (draft-ietf-httpapi-idempotency-key-header-07) on handlers
 * annotated with {@link Idempotente}. Runs after the Spring Security chain (see
 * {@link IdempotenciaConfig}), so the caller is already authenticated and URL-authorized.
 *
 * <ul>
 *   <li>missing header: 400 {@code IDEMPOTENCY_KEY_REQUERIDA}; not a UUID: 400
 *       {@code IDEMPOTENCY_KEY_INVALIDA}</li>
 *   <li>new key: run the handler, store the response (2xx and business 4xx) for replay</li>
 *   <li>same key, same request, completed: replay status and body, header
 *       {@code Idempotent-Replayed: true}, handler not executed</li>
 *   <li>same key still running: 409 {@code IDEMPOTENCIA_EN_PROCESO}</li>
 *   <li>same key, different request: 422 {@code IDEMPOTENCIA_PAYLOAD_DISTINTO}</li>
 *   <li>5xx, an escaped exception, or an auth-related denial (401/403/429, not a result of the
 *       operation): the key is released so the client may retry</li>
 * </ul>
 *
 * <p>Fingerprint: SHA-256 over method, request path, query string and the request body. JSON
 * bodies are canonicalized (object keys sorted, whitespace dropped) so a client that re-serializes
 * the same payload still matches; any other body is hashed as raw bytes. No {@code @Idempotente}
 * endpoint takes multipart today.
 */
public class IdempotenciaFilter extends OncePerRequestFilter {

    public static final String HEADER = "Idempotency-Key";
    public static final String HEADER_REPLAYED = "Idempotent-Replayed";
    public static final String CODE_REQUERIDA = "IDEMPOTENCY_KEY_REQUERIDA";
    public static final String CODE_INVALIDA = "IDEMPOTENCY_KEY_INVALIDA";
    public static final String CODE_EN_PROCESO = "IDEMPOTENCIA_EN_PROCESO";
    public static final String CODE_PAYLOAD_DISTINTO = "IDEMPOTENCIA_PAYLOAD_DISTINTO";

    private static final Logger log = LoggerFactory.getLogger(IdempotenciaFilter.class);
    private static final Pattern UUID_PATTERN = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    private final IdempotenciaService service;
    private final ObjectMapper objectMapper;
    private final ObjectMapper canonicalMapper;
    private final Supplier<HandlerMapping> handlerMapping;

    public IdempotenciaFilter(IdempotenciaService service, ObjectMapper objectMapper,
                              Supplier<HandlerMapping> handlerMapping) {
        this.service = service;
        this.objectMapper = objectMapper;
        this.canonicalMapper = objectMapper.copy().configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);
        this.handlerMapping = handlerMapping;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!esIdempotente(request)) {
            chain.doFilter(request, response);
            return;
        }

        List<String> valores = java.util.Collections.list(request.getHeaders(HEADER));
        if (valores.isEmpty() || valores.get(0).isBlank()) {
            escribirError(response, 400, CODE_REQUERIDA);
            return;
        }
        if (valores.size() > 1 || !UUID_PATTERN.matcher(valores.get(0).trim()).matches()) {
            escribirError(response, 400, CODE_INVALIDA);
            return;
        }
        String clave = UUID.fromString(valores.get(0).trim()).toString();

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long usuarioId)) {
            chain.doFilter(request, response); // anonymous POSTs are not part of this contract
            return;
        }

        byte[] cuerpo = request.getInputStream().readAllBytes();
        String operacion = "POST " + patron(request);
        String huella = huella(request, cuerpo);

        IdempotenciaService.Decision decision = service.iniciar(usuarioId, clave, operacion, huella);
        switch (decision.tipo()) {
            case EN_PROCESO -> escribirError(response, 409, CODE_EN_PROCESO);
            case PAYLOAD_DISTINTO -> escribirError(response, 422, CODE_PAYLOAD_DISTINTO);
            case REPETICION -> repetir(response, decision);
            case NUEVA -> ejecutar(new CuerpoCacheado(request, cuerpo), response, chain, decision.id());
        }
    }

    private void ejecutar(HttpServletRequest request, HttpServletResponse response, FilterChain chain, Long id)
            throws IOException, ServletException {
        ContentCachingResponseWrapper envuelta = new ContentCachingResponseWrapper(response);
        try {
            chain.doFilter(request, envuelta);
        } catch (IOException | ServletException | RuntimeException | Error e) {
            liberarSinFallar(id);
            throw e;
        }
        int status = envuelta.getStatus();
        if (status >= 500 || status == 401 || status == 403 || status == 429) {
            liberarSinFallar(id);
        } else {
            try {
                service.completar(id, status, new String(envuelta.getContentAsByteArray(), StandardCharsets.UTF_8));
            } catch (RuntimeException e) {
                // The operation already ran. Leaving the key EN_PROCESO makes a retry answer 409 until
                // the abandonment window passes, which is safer than letting it run a second time.
                log.error("[idempotencia] could not store response for key {}", id, e);
            }
        }
        envuelta.copyBodyToResponse();
    }

    private void liberarSinFallar(Long id) {
        try {
            service.liberar(id);
        } catch (RuntimeException e) {
            log.error("[idempotencia] could not release key {}", id, e);
        }
    }

    private void repetir(HttpServletResponse response, IdempotenciaService.Decision decision) throws IOException {
        response.setStatus(decision.status() == null ? 200 : decision.status());
        response.setHeader(HEADER_REPLAYED, "true");
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(decision.body());
    }

    private void escribirError(HttpServletResponse response, int status, String code) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(objectMapper.writeValueAsString(ApiResponse.error(status, code, List.of(code))));
    }

    private boolean esIdempotente(HttpServletRequest request) {
        try {
            if (!ServletRequestPathUtils.hasParsedRequestPath(request)) {
                ServletRequestPathUtils.parseAndCache(request);
            }
            HandlerExecutionChain cadena = handlerMapping.get().getHandler(request);
            return cadena != null
                    && cadena.getHandler() instanceof HandlerMethod metodo
                    && AnnotatedElementUtils.hasAnnotation(metodo.getMethod(), Idempotente.class);
        } catch (Exception e) {
            log.warn("[idempotencia] could not resolve handler for {}: {}", request.getRequestURI(), e.getMessage());
            return false;
        }
    }

    private static String patron(HttpServletRequest request) {
        Object patron = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        return patron != null ? patron.toString() : request.getRequestURI();
    }

    private String huella(HttpServletRequest request, byte[] cuerpo) {
        String query = request.getQueryString() == null ? "" : request.getQueryString();
        String entrada = request.getMethod() + " " + request.getRequestURI() + "?" + query + "\n";
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            sha.update(entrada.getBytes(StandardCharsets.UTF_8));
            sha.update(canonico(cuerpo));
            return HexFormat.of().formatHex(sha.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Sorted-key, whitespace-free JSON when the body parses as JSON, otherwise the raw bytes. */
    private byte[] canonico(byte[] cuerpo) {
        if (cuerpo.length == 0) {
            return cuerpo;
        }
        try {
            JsonNode nodo = objectMapper.readTree(cuerpo);
            if (nodo == null || nodo.isMissingNode()) {
                return cuerpo;
            }
            Object arbol = canonicalMapper.treeToValue(nodo, Object.class);
            return canonicalMapper.writeValueAsBytes(arbol);
        } catch (IOException e) {
            return cuerpo;
        }
    }

    /** Re-readable request body: the filter already consumed the stream to fingerprint it. */
    private static final class CuerpoCacheado extends HttpServletRequestWrapper {
        private final byte[] cuerpo;

        CuerpoCacheado(HttpServletRequest request, byte[] cuerpo) {
            super(request);
            this.cuerpo = cuerpo;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream origen = new ByteArrayInputStream(cuerpo);
            return new ServletInputStream() {
                @Override
                public int read() {
                    return origen.read();
                }

                @Override
                public boolean isFinished() {
                    return origen.available() == 0;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException();
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            String encoding = getCharacterEncoding();
            Charset charset = encoding == null ? StandardCharsets.UTF_8 : Charset.forName(encoding);
            return new BufferedReader(new InputStreamReader(getInputStream(), charset));
        }
    }
}
