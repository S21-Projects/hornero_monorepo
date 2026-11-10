package org.example.mail;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordResetEmailTemplateTest {

    private static final String ENLACE = "https://panel.elhornero.org/restablecer?token=abc_DEF-123";

    @Test
    void mensaje_addressesTheRecipientAndCarriesTheLinkInBothBodies() {
        MensajeCorreo m = PasswordResetEmailTemplate.mensaje("ana@example.com", ENLACE, 30);

        assertEquals("ana@example.com", m.to());
        assertEquals("Restablecé tu contraseña de Hornero", m.subject());
        assertTrue(m.text().contains(ENLACE));
        assertTrue(m.html().contains(ENLACE));
    }

    @Test
    void mensaje_statesTheExpiryAndThatItCanBeIgnored() {
        MensajeCorreo m = PasswordResetEmailTemplate.mensaje("ana@example.com", ENLACE, 30);

        assertTrue(m.text().contains("30 minutos"));
        assertTrue(m.text().contains("ignorar"));
        assertTrue(m.html().contains("30 minutos"));
    }

    @Test
    void mensaje_htmlEscapesTheLink() {
        MensajeCorreo m = PasswordResetEmailTemplate.mensaje("ana@example.com",
                "https://x.org/restablecer?token=a\"><script>b", 30);

        assertTrue(!m.html().contains("<script>"));
    }
}
