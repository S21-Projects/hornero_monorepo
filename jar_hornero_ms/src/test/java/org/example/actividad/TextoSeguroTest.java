package org.example.actividad;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** ASVS 16.4.1: nothing a client sends can forge or split a log line. */
class TextoSeguroTest {

    @Test
    void stripsCrLfAndOtherControlCharactersIntoSingleSpaces() {
        String sucio = "ok\r\n2026-10-10 INFO forged entry\tline\u0000\u001b[31mred";
        String limpio = TextoSeguro.limpiar(sucio, 500);

        assertThat(limpio).doesNotContain("\r", "\n", "\t", "\u0000", "\u001b");
        assertThat(limpio).startsWith("ok 2026-10-10 INFO forged entry line");
    }

    @Test
    void stripsUnicodeLineSeparatorsAndBidiOverrides() {
        String limpio = TextoSeguro.limpiar("a b c\u0085d‮evil​x", 100);

        assertThat(limpio).isEqualTo("a b c d evil x").doesNotContain(" ", "‮", "​");
    }

    @Test
    void truncatesToTheColumnSize() {
        assertThat(TextoSeguro.limpiar("x".repeat(900), 500)).hasSize(500);
    }

    @Test
    void blankAndNullBecomeNull() {
        assertThat(TextoSeguro.limpiar(null, 10)).isNull();
        assertThat(TextoSeguro.limpiar("  \r\n\t ", 10)).isNull();
    }

    @Test
    void ipAcceptsLiteralsAndDropsAnythingElse() {
        assertThat(TextoSeguro.ipONull("190.12.3.4")).isEqualTo("190.12.3.4");
        assertThat(TextoSeguro.ipONull("2001:db8::1")).isEqualTo("2001:db8::1");
        assertThat(TextoSeguro.ipONull("1.2.3.4\r\nX-Forged: 1")).isNull();
        assertThat(TextoSeguro.ipONull("<script>")).isNull();
        assertThat(TextoSeguro.ipONull(null)).isNull();
    }
}
