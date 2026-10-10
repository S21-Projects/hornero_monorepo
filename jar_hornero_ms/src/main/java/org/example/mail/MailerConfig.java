package org.example.mail;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Provides the {@link Mailer} bean. Missing Resend configuration fails startup
 * unless {@code MAIL_LOG_ONLY=true} explicitly opts into the log-only mailer
 * (local dev / tests), so production can never silently drop OTP emails.
 */
@Configuration
@Slf4j
public class MailerConfig {

    @Bean
    public Mailer mailer(
            @Value("${app.mail.resend-api-key:}") String resendApiKey,
            @Value("${app.mail.otp-from-email:}") String otpFromEmail,
            @Value("${app.mail.log-only:false}") boolean logOnly) {
        if (resendApiKey.isBlank() || otpFromEmail.isBlank()) {
            if (!logOnly) {
                throw new IllegalStateException(
                        "RESEND_API_KEY and OTP_FROM_EMAIL must be set to send OTP emails. " +
                        "Set MAIL_LOG_ONLY=true to log verification codes instead (local dev only).");
            }
            log.warn("[otp-mail] MAIL_LOG_ONLY activo y RESEND_API_KEY / OTP_FROM_EMAIL no configurados. " +
                    "Los códigos de verificación sólo se escriben en el log.");
            return logMailer();
        }
        return resendMailer(resendApiKey, otpFromEmail);
    }

    private Mailer logMailer() {
        // Never log the code itself (ASVS 16.2.5): anyone with log access could take over the
        // account. Local dev reads the code from the database / test hooks instead.
        return (email, codigo) -> log.info("[otp-mail] Código de verificación generado para {} (no se registra)",
                enmascarar(email));
    }

    /** {@code juan.perez@example.com} -> {@code j***@example.com}; also strips control characters. */
    static String enmascarar(String email) {
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
        return (email, codigo) -> {
            client.send(
                    from,
                    email,
                    OtpEmailTemplate.subject(),
                    OtpEmailTemplate.htmlBody(codigo),
                    OtpEmailTemplate.textBody(codigo)
            );
        };
    }
}
