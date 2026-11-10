package org.example.donacion;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins `specs/donacion-fondo-comun/spec.md`'s "Location and Categoria Required for Pool
 * Donations": a FONDO_COMUN donación's donante-marked pickup point is write-only and must never
 * leave the MS through either response DTO, for any role, including the owning donante.
 */
class DonacionResponseTest {

    private static final ObjectMapper MAPPER = new ObjectMapper().registerModule(new JavaTimeModule());

    @Test
    void donacionResponse_neverDeclaresLatitudOrLongitudComponents() {
        for (RecordComponent component : DonacionResponse.class.getRecordComponents()) {
            String name = component.getName().toLowerCase();
            assertThat(name).doesNotContain("latitud");
            assertThat(name).doesNotContain("longitud");
        }
    }

    @Test
    void donacionActivaResponse_neverDeclaresLatitudOrLongitudComponents() {
        for (RecordComponent component : DonacionActivaResponse.class.getRecordComponents()) {
            String name = component.getName().toLowerCase();
            assertThat(name).doesNotContain("latitud");
            assertThat(name).doesNotContain("longitud");
        }
    }

    @Test
    void donacionResponse_serializedJson_neverContainsLatitudOrLongitudKeys() throws Exception {
        DonacionResponse response = new DonacionResponse(
                1L, LocalDate.now(), null, "OFRECIDA", "obs", "Donante",
                null, null, "", "", 2L, (Instant) null, (Instant) null,
                "FONDO_COMUN", "NO_PERECEDERO", "EN_FONDO", java.util.List.of()
        );

        Map<?, ?> json = MAPPER.readValue(MAPPER.writeValueAsString(response), Map.class);

        assertThat(json.keySet()).noneMatch(k -> k.toString().toLowerCase().contains("latitud"));
        assertThat(json.keySet()).noneMatch(k -> k.toString().toLowerCase().contains("longitud"));
    }

    @Test
    void donacionActivaResponse_serializedJson_neverContainsLatitudOrLongitudKeys() throws Exception {
        DonacionActivaResponse response = new DonacionActivaResponse(
                1L, LocalDate.now(), null, "OFRECIDA", "obs", 2L, "Donante",
                null, "", null, "", (Instant) null, (Instant) null,
                null, null, (Instant) null,
                "FONDO_COMUN", "NO_PERECEDERO", "EN_FONDO", java.util.List.of(), false, 0
        );

        Map<?, ?> json = MAPPER.readValue(MAPPER.writeValueAsString(response), Map.class);

        assertThat(json.keySet()).noneMatch(k -> k.toString().toLowerCase().contains("latitud"));
        assertThat(json.keySet()).noneMatch(k -> k.toString().toLowerCase().contains("longitud"));
        assertThat(json.get("estancada")).isEqualTo(false);
        assertThat(((Number) json.get("diasEnEstado")).longValue()).isZero();
    }
}
