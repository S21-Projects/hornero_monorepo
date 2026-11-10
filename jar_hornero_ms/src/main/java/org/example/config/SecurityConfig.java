package org.example.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        // Spring Security 6.1+ re-runs AuthorizationFilter on the internal
                        // /error forward too. JwtAuthFilter doesn't repopulate auth for that
                        // dispatch, so without this, every ResponseStatusException (403/404/etc.)
                        // thrown from a controller/service loses its JSON body — the forward to
                        // /error itself gets denied, producing an empty response.
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**",
                                "/v3/api-docs.yaml").permitAll()
                        // Defense in depth: /activas is also gated by @PreAuthorize on the
                        // controller, but this explicit matcher must be declared before the
                        // permitAll GET-donaciones block below (Spring evaluates matchers in
                        // declaration order), so an anonymous request never reaches the
                        // method-security layer expecting to be allowed through.
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                                "/api/donaciones/activas").hasRole("ADMINISTRADOR")
                        // AD-8: accreditation evidence, the audit trail and the legajo are never
                        // world-readable. Declared before the permitAll GET-organizaciones block
                        // below (Spring evaluates matchers in declaration order) — placement
                        // after it would silently leak evidence declarations, auditor identities
                        // and the full event log to anonymous users.
                        // AcreditacionControllerSecurityTest asserts the anonymous case is denied
                        // (this chain has no httpBasic()/formLogin() and no custom
                        // AuthenticationEntryPoint configured anywhere in the app, so the default
                        // Http403ForbiddenEntryPoint answers both "not authenticated" and "wrong
                        // role" with 403 — confirmed by exercising the real chain via
                        // @Import(SecurityConfig.class), not @WebMvcTest's default fallback
                        // security auto-configuration, which would otherwise mask this matcher
                        // entirely and always answer 401 regardless of what this matcher says).
                        // Role granularity (ADMIN vs owning REFERENTE vs DONANTE) is enforced by
                        // @PreAuthorize on AcreditacionController, now that
                        // GlobalExceptionHandler translates AccessDeniedException to 403 instead
                        // of falling into its generic 500 handler.
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                                "/api/organizaciones/*/acreditacion",
                                "/api/organizaciones/*/acreditacion/**",
                                "/api/organizaciones/*/legajo").authenticated()
                        // AD-8 (tesis-core-features, slice 4a): the cross-org audit queue lives on
                        // its own root, deliberately NOT under /api/organizaciones/**, so it does
                        // not depend on this file's matcher ordering relative to that resource's
                        // permitAll GET block below. Still declared explicitly, and ahead of
                        // /api/necesidades and /api/donaciones' permitAll GET blocks, out of the
                        // same defense-in-depth discipline as every other admin-only matcher here.
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                                "/api/auditoria/**").hasRole("ADMINISTRADOR")
                        // AD-6: delivery-code confirmation state is never world-readable.
                        // Declared before the permitAll GET-donaciones block below (Spring
                        // evaluates matchers in declaration order) — placement after it would
                        // silently leak both parties' confirmation status to anonymous users.
                        // Method granularity (only the donación's donante/referente, never an
                        // unrelated user) is enforced by @PreAuthorize + ParticipantesDonacion on
                        // EntregaController/EntregaService.
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                                "/api/donaciones/*/entrega").authenticated()
                        // AD-9 (tesis-core-features, slice 5c-ii): manual ronda trigger/history is
                        // ADMINISTRADOR-only at every verb — spec `ronda-asignacion`'s "Manual
                        // ADMINISTRADOR Trigger Only" requirement. `/api/rondas/**` is its own root
                        // (not under /api/donaciones/** or /api/organizaciones/**), so this matcher
                        // does not depend on declaration order relative to those resources' permitAll
                        // GET blocks below, but it is still declared ahead of them out of the same
                        // defense-in-depth discipline as every other admin-only matcher here.
                        .requestMatchers("/api/rondas/**").hasRole("ADMINISTRADOR")
                        // N10: the activity log is ADMINISTRADOR-only and read-only. Its own root, declared
                        // ahead of the permitAll GET blocks below like every other admin-only matcher.
                        .requestMatchers("/api/actividad", "/api/actividad/**").hasRole("ADMINISTRADOR")
                        // Feature catalogo-articulos (C3): the catalog is publicly readable but
                        // ADMINISTRADOR-only to write. The GET permitAll matcher must be declared
                        // before the catch-all admin-only matcher on the same root (Spring
                        // evaluates matchers in declaration order) — swapping the order would make
                        // every verb admin-only, including GET.
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                                "/api/articulos", "/api/articulos/**").permitAll()
                        .requestMatchers("/api/articulos/**").hasRole("ADMINISTRADOR")
                        // AD-9: an assignment's score breakdown and ronda history are never
                        // world-readable. Declared before the permitAll GET-donaciones block below
                        // (Spring evaluates matchers in declaration order) — placement after it would
                        // silently leak scoring/explainability data to anonymous users. Role
                        // granularity (owner donante, involved referente, admin) is enforced by
                        // AsignacionController/AsignacionService.
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                                "/api/donaciones/*/asignaciones").authenticated()
                        // Claim flow: never world-readable (claimant phone/email, evidence). Role granularity
                        // (REFERENTE submits, ADMINISTRADOR resolves) is @PreAuthorize on ReclamoController.
                        // Declared before the permitAll GET blocks below like every other private matcher.
                        .requestMatchers("/api/reclamos", "/api/reclamos/**").authenticated()
                        // Report flow: any authenticated user submits; ADMINISTRADOR resolves (@PreAuthorize).
                        .requestMatchers("/api/reportes", "/api/reportes/**").authenticated()
                        // Public read-only endpoints — no account required
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                                "/api/organizaciones",
                                "/api/organizaciones/**",
                                "/api/necesidades",
                                "/api/necesidades/**",
                                "/api/donaciones",
                                "/api/donaciones/**").permitAll()
                        .anyRequest().authenticated())
                // N9: 401 USUARIO_INACTIVO for a deactivated user's token; every other
                // unauthenticated denial keeps the previous default 403.
                .exceptionHandling(ex -> ex.authenticationEntryPoint((request, response, authException) -> {
                    if (UsuarioInactivo.isMarked(request)) {
                        UsuarioInactivo.write401(response);
                    } else {
                        response.sendError(jakarta.servlet.http.HttpServletResponse.SC_FORBIDDEN, "Forbidden");
                    }
                }))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()))
                .build();
    }
}
