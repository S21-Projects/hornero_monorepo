package org.example.idempotencia;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerMapping;

/**
 * Registers {@link IdempotenciaFilter} as a servlet filter ordered after the Spring Security chain
 * (order -100), so it sees an authenticated caller. A {@code @Configuration} (not a {@code @Component}
 * filter) on purpose: {@code @WebMvcTest} slices scan filters but not configuration classes, so the
 * existing controller slice tests are untouched and the key contract is exercised by the
 * {@code @SpringBootTest} suites.
 */
@Configuration
public class IdempotenciaConfig {

    @Bean
    public FilterRegistrationBean<IdempotenciaFilter> idempotenciaFilterRegistration(
            IdempotenciaService service, ObjectMapper objectMapper, ApplicationContext context) {
        IdempotenciaFilter filtro = new IdempotenciaFilter(service, objectMapper,
                () -> context.getBean("requestMappingHandlerMapping", HandlerMapping.class));
        FilterRegistrationBean<IdempotenciaFilter> registro = new FilterRegistrationBean<>(filtro);
        registro.addUrlPatterns("/api/*");
        registro.setOrder(0);
        return registro;
    }
}
