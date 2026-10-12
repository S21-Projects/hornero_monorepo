package org.example.mail;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(OutputCaptureExtension.class)
class MailerConfigTest {

    private final MailerConfig config = new MailerConfig();

    @Test
    void missingConfig_logOnlyFalse_failsStartupNamingTheVariables() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> config.mailer("", "", false));
        assertTrue(ex.getMessage().contains("RESEND_API_KEY"));
        assertTrue(ex.getMessage().contains("MAIL_FROM_EMAIL"));
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
    void fullConfig_logOnlyTrue_neverSends(CapturedOutput output) {
        // MAIL_LOG_ONLY wins over a configured key: a local stack holding a real key must not mail.
        Mailer mailer = config.mailer("re_key", "no-reply@x.org", true);
        assertDoesNotThrow(() -> mailer.enviarOtp("someone@example.org", "123456"));
        assertTrue(output.getOut().contains("s***@example.org"));
    }

    @Test
    void fullConfig_returnsMailerWithoutSending() {
        assertNotNull(config.mailer("re_key", "no-reply@x.org", false));
    }

    // N10 / ASVS 16.2.5: the log-only mailer must not write the code, or anyone who can read the
    // logs could take over an account during the code's lifetime.
    @Test
    void logOnlyMailer_neverWritesTheCodeAndMasksTheEmail(CapturedOutput output) {
        Mailer mailer = config.mailer("", "", true);

        mailer.enviarOtp("juan.perez@example.com", "482913");

        assertTrue(output.getAll().contains("j***@example.com"));
        assertFalse(output.getAll().contains("482913"));
        assertFalse(output.getAll().contains("juan.perez"));
    }

    // N14: the seam is generic now. A log-only mailer must never print what makes a message
    // actionable (reset link, token, code), only who it was for.
    @Test
    void logOnlyMailer_genericMessage_neverWritesBodyOrLinks(CapturedOutput output) {
        Mailer mailer = config.mailer("", "", true);

        mailer.enviar(new MensajeCorreo("juan.perez@example.com", "Asunto",
                "<a href=\"https://panel.example/restablecer?token=SECRETTOKEN\">x</a>",
                "https://panel.example/restablecer?token=SECRETTOKEN"));

        assertTrue(output.getAll().contains("j***@example.com"));
        assertFalse(output.getAll().contains("SECRETTOKEN"));
        assertFalse(output.getAll().contains("restablecer"));
        assertFalse(output.getAll().contains("juan.perez"));
    }

    @Test
    void mensajeCorreo_toStringNeverExposesBody() {
        MensajeCorreo m = new MensajeCorreo("a@b.com", "Asunto", "<p>SECRETTOKEN</p>", "SECRETTOKEN");
        assertFalse(m.toString().contains("SECRETTOKEN"));
    }

    @Test
    void enmascarar_handlesOddInput() {
        assertEquals("***", MailerConfig.enmascarar("sin-arroba"));
        assertEquals("(sin email)", MailerConfig.enmascarar(null));
        assertEquals("(sin email)", MailerConfig.enmascarar("  "));
        assertFalse(MailerConfig.enmascarar("a\r\nFORGED@x.org").contains("\n"));
    }
}
