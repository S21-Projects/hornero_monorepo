package org.example.mail;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MailerConfigTest {

    private final MailerConfig config = new MailerConfig();

    @Test
    void missingConfig_logOnlyFalse_failsStartupNamingTheVariables() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> config.mailer("", "", false));
        assertTrue(ex.getMessage().contains("RESEND_API_KEY"));
        assertTrue(ex.getMessage().contains("OTP_FROM_EMAIL"));
        assertTrue(ex.getMessage().contains("MAIL_LOG_ONLY"));
    }

    @Test
    void partialConfig_logOnlyFalse_fails() {
        assertThrows(IllegalStateException.class, () -> config.mailer("re_key", "", false));
        assertThrows(IllegalStateException.class, () -> config.mailer("", "no-reply@x.org", false));
    }

    @Test
    void missingConfig_logOnlyTrue_returnsLogMailer() {
        Mailer mailer = config.mailer("", "", true);
        assertNotNull(mailer);
        assertDoesNotThrow(() -> mailer.enviarOtp("a@b.com", "123456"));
    }

    @Test
    void fullConfig_returnsMailerWithoutSending() {
        assertNotNull(config.mailer("re_key", "no-reply@x.org", false));
    }
}
