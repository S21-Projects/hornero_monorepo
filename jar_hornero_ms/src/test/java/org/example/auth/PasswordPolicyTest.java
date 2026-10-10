package org.example.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** NIST SP 800-63B-4 3.1.1.2 / OWASP ASVS 5.0 V6.2 password policy. */
class PasswordPolicyTest {

    private static final String EMAIL = "lucia.gomez@example.com";
    private static final String NOMBRE = "Lucía Gómez";

    private final PasswordPolicy policy = new PasswordPolicy();

    private void assertRejected(String password, String code) {
        assertThatThrownBy(() -> policy.validate(password, EMAIL, NOMBRE))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                    org.assertj.core.api.Assertions.assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                    org.assertj.core.api.Assertions.assertThat(ex.getReason()).isEqualTo(code);
                });
    }

    private void assertAccepted(String password) {
        assertThatCode(() -> policy.validate(password, EMAIL, NOMBRE)).doesNotThrowAnyException();
    }

    // --- length ---

    @Test
    void fourteenCharacters_rejectedAsTooShort() {
        assertRejected("kq7vbn2xw8zpt4", "PASSWORD_DEMASIADO_CORTA");
    }

    @Test
    void fifteenCharacters_accepted() {
        assertAccepted("kq7vbn2xw8zpt4m");
    }

    @Test
    void sixtyFourCharacters_accepted() {
        assertAccepted("kq7vbn2xw8zpt4m".repeat(4).substring(0, 60) + "r5tY");
    }

    @Test
    void sixtyFiveCharacters_rejectedAsTooLong() {
        assertRejected("kq7vbn2xw8zpt4m".repeat(4).substring(0, 60) + "r5tYu", "PASSWORD_DEMASIADO_LARGA");
    }

    @Test
    void multibyteWithin64CodePointsButOver72Bytes_rejectedAsTooLong() {
        // 40 x "ñ" (2 bytes each) + 20 ASCII = 60 code points, 100 bytes
        String password = "ñ".repeat(40) + "kq7vbn2xw8zpt4m5r9tw";
        assertRejected(password, "PASSWORD_DEMASIADO_LARGA");
    }

    @Test
    void lengthCountsCodePointsNotUtf16Units() {
        // 15 distinct emoji = 15 code points (30 UTF-16 units, 60 bytes): accepted.
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 15; i++) {
            sb.appendCodePoint(0x1F600 + i * 7);
        }
        assertAccepted(sb.toString());
    }

    @Test
    void fourteenEmoji_rejectedAsTooShortEvenThoughUtf16LengthIs28() {
        String password = new String(Character.toChars(0x1F600)).repeat(7)
                + new String(Character.toChars(0x1F680)).repeat(7);
        assertRejected(password, "PASSWORD_DEMASIADO_CORTA");
    }

    // --- no composition rules; spaces and unicode allowed ---

    @Test
    void onlyLowercaseLetters_noCompositionRuleApplied() {
        assertAccepted("zebrafluviomontana");
    }

    @Test
    void passphraseWithSpaces_accepted() {
        assertAccepted("la cafetera azul canta");
    }

    @Test
    void unicodeLetters_accepted() {
        assertAccepted("ñandú cruzó el río");
    }

    // --- blocklist ---

    @Test
    void commonPasswordFromBlocklist_rejected() {
        assertRejected("1234567890123456", "PASSWORD_COMUN");
    }

    @Test
    void blocklistMatchIsCaseInsensitive() {
        assertRejected("Qwertyuiopasdfghjkl", "PASSWORD_COMUN");
    }

    @Test
    void blocklistBundledWithAtLeast3000EntriesRelevantToPolicy() {
        org.assertj.core.api.Assertions.assertThat(policy.blocklistSize()).isGreaterThanOrEqualTo(3000);
    }

    @Test
    void blocklistIsExactMatchOnly_paddedCommonPasswordIsNotRejectedByTheList() {
        assertAccepted("qwertyuiopasdfghjkl-zebra");
    }

    // --- context-specific derivatives ---

    @Test
    void containsEmailLocalPart_rejected() {
        assertRejected("mi-clave-lucia.gomez-2026", "PASSWORD_CONTIENE_DATOS_PERSONALES");
    }

    @Test
    void emailLocalPartShorterThanFourChars_ignored() {
        assertThatCode(() -> policy.validate("abc-zebra-fluvial-monte", "abc@example.com", NOMBRE))
                .doesNotThrowAnyException();
    }

    @Test
    void containsNombreIgnoringCaseAndAccents_rejected() {
        assertRejected("xx-LUCIAGOMEZ-xx-zebra", "PASSWORD_CONTIENE_DATOS_PERSONALES");
    }

    @Test
    void containsNombreToken_rejected() {
        assertRejected("mi-gomez-es-el-mejor-1", "PASSWORD_CONTIENE_DATOS_PERSONALES");
    }

    @ParameterizedTest
    @ValueSource(strings = {"HorneroSuperSecreto1", "mi-elhornero-clave-x9"})
    void serviceNameVariants_rejected(String password) {
        assertRejected(password, "PASSWORD_CONTIENE_DATOS_PERSONALES");
    }

    // --- trivially repetitive / sequential ---

    @Test
    void singleCharacterRepeated_rejected() {
        assertRejected("aaaaaaaaaaaaaaa", "PASSWORD_COMUN");
    }

    @Test
    void shortUnitRepeated_rejected() {
        assertRejected("xyzxyzxyzxyzxyzxyz", "PASSWORD_COMUN");
    }

    @Test
    void ascendingDigitSequence_rejected() {
        assertRejected("123456789012345", "PASSWORD_COMUN");
    }

    @Test
    void descendingLetterSequence_rejected() {
        assertRejected("zyxwvutsrqponmlk", "PASSWORD_COMUN");
    }

    @Test
    void nullOrMissingContext_doesNotBreakValidation() {
        assertThatCode(() -> policy.validate("kq7vbn2xw8zpt4m", null, null)).doesNotThrowAnyException();
    }
}
