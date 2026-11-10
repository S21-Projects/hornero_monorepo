package org.example.mail;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OtpEmailTemplateTest {

    @Test
    void mensaje_wrapsTheExistingOtpCopy() {
        MensajeCorreo m = OtpEmailTemplate.mensaje("ana@example.com", "482913");

        assertEquals("ana@example.com", m.to());
        assertEquals(OtpEmailTemplate.subject(), m.subject());
        assertEquals(OtpEmailTemplate.htmlBody("482913"), m.html());
        assertEquals(OtpEmailTemplate.textBody("482913"), m.text());
        assertTrue(m.text().contains("482913"));
    }
}
