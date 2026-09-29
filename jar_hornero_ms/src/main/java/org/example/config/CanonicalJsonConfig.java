package org.example.config;

import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

/**
 * AD-5: exposes the canonical JSON mapper used to serialize {@code OrganizacionEvento.payload} as
 * a single named bean so it cannot silently diverge from the default Spring mapper. Keys are
 * sorted alphabetically so two semantically-equal payloads produce byte-identical output — a
 * property the {@code text} column type (never {@code jsonb}) depends on.
 */
@Configuration
public class CanonicalJsonConfig {

    /**
     * Declaring any {@link ObjectMapper} bean makes Spring Boot back off its own, so the default
     * mapper (JSR-310 dates, Boot defaults) must be declared explicitly and marked primary. MVC
     * serialization keeps using it; the canonical mapper stays reserved for event payloads.
     */
    @Bean
    @Primary
    public ObjectMapper objectMapper(Jackson2ObjectMapperBuilder builder) {
        return builder.build();
    }

    @Bean
    public ObjectMapper canonicalObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);
        mapper.configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true);
        return mapper;
    }
}
