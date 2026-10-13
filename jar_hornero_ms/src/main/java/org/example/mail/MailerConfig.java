package org.example.mail;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Provides the {@link Mailer} bean. Missing Resend configuration fails startup
 * unless {@code MAIL_LOG_ONLY=true} explicitly opts into the log-only mailer
 * (local dev / tests), so production can never silently drop emails. The sender is
 * {@code MAIL_FROM_EMAIL}, falling back to the legacy {@code OTP_FROM_EMAIL} (see application.yml).
 */
@Configuration
@Slf4j
public class MailerConfig {

    @Bean
    public Mailer mailer(
            @Value("${app.mail.resend-api-key:}") String resendApiKey,
            @Value("${app.mail.from-email:}") String fromEmail,
            @Value("${app.mail.log-only:false}") boolean logOnly) {
        // MAIL_LOG_ONLY always wins: a local stack that happens to hold a real key must never send.
        if (logOnly) {
            log.warn("[mail] MAIL_LOG_ONLY activo: los correos no se envían, sólo se registra el destinatario enmascarado.");
            return logMailer();
        }
        if (resendApiKey.isBlank() || fromEmail.isBlank()) {
            throw new IllegalStateException(
                    "RESEND_API_KEY and MAIL_FROM_EMAIL (or the legacy OTP_FROM_EMAIL) must be set to send emails. " +
                    "Set MAIL_LOG_ONLY=true to skip sending and only log that a message was generated (local dev only).");
        }
        return resendMailer(resendApiKey, fromEmail);
    }

    private Mailer logMailer() {
        // Never log the body (ASVS 16.2.5): it carries one-time codes and reset links, so anyone
        // with log access could take over an account. Local dev reads the code from the database.
        return mensaje -> log.info("[mail] Mensaje '{}' generado para {} (contenido no se registra)",
                mensaje.subject(), enmascarar(mensaje.to()));
    }

    /** {@code juan.perez@example.com} -> {@code j***@example.com}; also strips control characters. */
    public static String enmascarar(String email) {
        if (email == null || email.isBlank()) {
            return "(sin email)";
        }
        String limpio = org.example.actividad.TextoSeguro.limpiar(email, 254);
        if (limpio == null) {
            return "(sin email)";
        }
        int arroba = limpio.indexOf('@');
        if (arroba <= 0) {
            return "***";
        }
        return limpio.charAt(0) + "***" + limpio.substring(arroba);
    }

    private Mailer resendMailer(String apiKey, String from) {
        ResendClient client = new ResendClient(apiKey);
        return mensaje -> client.send(from, mensaje.to(), mensaje.subject(), mensaje.html(), mensaje.text());
    }
}
