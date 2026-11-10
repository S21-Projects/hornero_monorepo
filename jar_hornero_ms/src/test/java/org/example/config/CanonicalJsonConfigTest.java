package org.example.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AD-5: the {@code canonicalObjectMapper} bean must serialize semantically-equal payloads to
 * byte-identical text so an event's {@code payload} column is reproducible for a future hash
 * chain — never {@code jsonb}, which PostgreSQL reorders on write.
 */
class CanonicalJsonConfigTest {

    private final ObjectMapper mapper = new CanonicalJsonConfig().canonicalObjectMapper();

    @Test
    void serializesOutOfOrderKeysAlphabetically() throws Exception {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("zeta", 1);
        map.put("alpha", 2);
        map.put("mid", 3);

        String json = mapper.writeValueAsString(map);

        assertThat(json).isEqualTo("{\"alpha\":2,\"mid\":3,\"zeta\":1}");
    }

    @Test
    void semanticallyEqualMapsProduceByteIdenticalOutput() throws Exception {
        Map<String, Object> mapA = new LinkedHashMap<>();
        mapA.put("b", 2);
        mapA.put("a", 1);

        Map<String, Object> mapB = new LinkedHashMap<>();
        mapB.put("a", 1);
        mapB.put("b", 2);

        String jsonA = mapper.writeValueAsString(mapA);
        String jsonB = mapper.writeValueAsString(mapB);

        assertThat(jsonA).isEqualTo(jsonB);
    }
}
