package org.example.config;

import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * AD-5: exposes the canonical JSON mapper used to serialize {@code OrganizacionEvento.payload} as
 * a single named bean so it cannot silently diverge from the default Spring mapper. Keys are
 * sorted alphabetically so two semantically-equal payloads produce byte-identical output — a
 * property the {@code text} column type (never {@code jsonb}) depends on.
 */
@Configuration
public class CanonicalJsonConfig {

    @Bean
    public ObjectMapper canonicalObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);
        mapper.configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true);
        return mapper;
    }
}
