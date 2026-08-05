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
                        .requestMatchers("/h2-console/**").permitAll()
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
                        // Public read-only endpoints — no account required
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                                "/api/organizaciones",
                                "/api/organizaciones/**",
                                "/api/necesidades",
                                "/api/necesidades/**",
                                "/api/donaciones",
                                "/api/donaciones/**").permitAll()
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()))
                .build();
    }
}
