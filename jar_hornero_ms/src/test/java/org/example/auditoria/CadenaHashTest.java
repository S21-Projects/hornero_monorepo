package org.example.auditoria;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class CadenaHashTest {

    private static CadenaHash.Contenido base() {
        return new CadenaHash.Contenido(7L, "NIVEL_ELEVADO", Instant.parse("2026-01-02T03:04:05.123456Z"),
                42L, "ADMINISTRADOR", "N0", "N1", null, null, "Validación ñ\n\"x\"", null);
    }

    @Test
    void matchesAnIndependentlyComputedVector() {
        // Computed with a separate Python implementation of the documented encoding.
        assertThat(CadenaHash.hash(CadenaHash.GENESIS, base()))
                .isEqualTo("0a472467687385dac52a1b3e725aa63a48033a8030785525d28816765215a122");
    }

    @Test
    void isDeterministic() {
        assertThat(CadenaHash.hash(CadenaHash.GENESIS, base())).isEqualTo(CadenaHash.hash(CadenaHash.GENESIS, base()));
    }

    @Test
    void theHashDependsOnThePreviousHash() {
        assertThat(CadenaHash.hash(CadenaHash.GENESIS, base()))
                .isNotEqualTo(CadenaHash.hash("1".repeat(64), base()));
    }

    @Test
    void nanosecondsBeyondTheDatabasePrecisionDoNotChangeTheHash() {
        CadenaHash.Contenido nanos = new CadenaHash.Contenido(7L, "NIVEL_ELEVADO",
                Instant.parse("2026-01-02T03:04:05.123456789Z"),
                42L, "ADMINISTRADOR", "N0", "N1", null, null, "Validación ñ\n\"x\"", null);
        assertThat(CadenaHash.hash(CadenaHash.GENESIS, nanos)).isEqualTo(CadenaHash.hash(CadenaHash.GENESIS, base()));
    }

    @Test
    void nullAndEmptyStringAreDifferentValues() {
        CadenaHash.Contenido nulo = withMotivo(null);
        CadenaHash.Contenido vacio = withMotivo("");
        assertThat(CadenaHash.hash(CadenaHash.GENESIS, nulo)).isNotEqualTo(CadenaHash.hash(CadenaHash.GENESIS, vacio));
    }

    @Test
    void movingTextAcrossAFieldBoundaryChangesTheHash() {
        CadenaHash.Contenido a = new CadenaHash.Contenido(1L, "T", Instant.EPOCH, null, null, null, null, null, null, "a", "bc");
        CadenaHash.Contenido b = new CadenaHash.Contenido(1L, "T", Instant.EPOCH, null, null, null, null, null, null, "ab", "c");
        assertThat(CadenaHash.hash(CadenaHash.GENESIS, a)).isNotEqualTo(CadenaHash.hash(CadenaHash.GENESIS, b));
    }

    @Test
    void everyFieldIsCovered() {
        String original = CadenaHash.hash(CadenaHash.GENESIS, base());
        Instant t = Instant.parse("2026-01-02T03:04:05.123456Z");
        assertThat(original).isNotEqualTo(CadenaHash.hash(CadenaHash.GENESIS,
                new CadenaHash.Contenido(8L, "NIVEL_ELEVADO", t, 42L, "ADMINISTRADOR", "N0", "N1", null, null, "Validación ñ\n\"x\"", null)));
        assertThat(original).isNotEqualTo(CadenaHash.hash(CadenaHash.GENESIS,
                new CadenaHash.Contenido(7L, "NIVEL_REDUCIDO", t, 42L, "ADMINISTRADOR", "N0", "N1", null, null, "Validación ñ\n\"x\"", null)));
        assertThat(original).isNotEqualTo(CadenaHash.hash(CadenaHash.GENESIS,
                new CadenaHash.Contenido(7L, "NIVEL_ELEVADO", t.plusNanos(1000), 42L, "ADMINISTRADOR", "N0", "N1", null, null, "Validación ñ\n\"x\"", null)));
        assertThat(original).isNotEqualTo(CadenaHash.hash(CadenaHash.GENESIS,
                new CadenaHash.Contenido(7L, "NIVEL_ELEVADO", t, 43L, "ADMINISTRADOR", "N0", "N1", null, null, "Validación ñ\n\"x\"", null)));
        assertThat(original).isNotEqualTo(CadenaHash.hash(CadenaHash.GENESIS,
                new CadenaHash.Contenido(7L, "NIVEL_ELEVADO", t, 42L, "REFERENTE", "N0", "N1", null, null, "Validación ñ\n\"x\"", null)));
        assertThat(original).isNotEqualTo(CadenaHash.hash(CadenaHash.GENESIS,
                new CadenaHash.Contenido(7L, "NIVEL_ELEVADO", t, 42L, "ADMINISTRADOR", "N1", "N1", null, null, "Validación ñ\n\"x\"", null)));
        assertThat(original).isNotEqualTo(CadenaHash.hash(CadenaHash.GENESIS,
                new CadenaHash.Contenido(7L, "NIVEL_ELEVADO", t, 42L, "ADMINISTRADOR", "N0", "N2", null, null, "Validación ñ\n\"x\"", null)));
        assertThat(original).isNotEqualTo(CadenaHash.hash(CadenaHash.GENESIS,
                new CadenaHash.Contenido(7L, "NIVEL_ELEVADO", t, 42L, "ADMINISTRADOR", "N0", "N1", "ESTATUTO", null, "Validación ñ\n\"x\"", null)));
        assertThat(original).isNotEqualTo(CadenaHash.hash(CadenaHash.GENESIS,
                new CadenaHash.Contenido(7L, "NIVEL_ELEVADO", t, 42L, "ADMINISTRADOR", "N0", "N1", null, 9L, "Validación ñ\n\"x\"", null)));
        assertThat(original).isNotEqualTo(CadenaHash.hash(CadenaHash.GENESIS,
                new CadenaHash.Contenido(7L, "NIVEL_ELEVADO", t, 42L, "ADMINISTRADOR", "N0", "N1", null, null, "Validación ñ\n\"x\"", "{}")));
    }

    private static CadenaHash.Contenido withMotivo(String motivo) {
        return new CadenaHash.Contenido(7L, "NIVEL_ELEVADO", Instant.parse("2026-01-02T03:04:05.123456Z"),
                42L, "ADMINISTRADOR", "N0", "N1", null, null, motivo, null);
    }
}
