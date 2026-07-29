package org.example.mail;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Provides the {@link Mailer} bean. Falls back to a log-only mailer when
 * {@code RESEND_API_KEY} is absent, so local dev keeps working without
 * credentials (mirrors {@code getMailer()} in the Astro service).
 */
@Configuration
@Slf4j
public class MailerConfig {

    @Bean
    public Mailer mailer(
            @Value("${app.mail.resend-api-key:}") String resendApiKey,
            @Value("${app.mail.otp-from-email:}") String otpFromEmail) {
        if (resendApiKey.isBlank() || otpFromEmail.isBlank()) {
            log.warn("[otp-mail] RESEND_API_KEY o OTP_FROM_EMAIL no configurados. " +
                    "Los códigos de verificación sólo se escriben en el log.");
            return logMailer();
        }
        return resendMailer(resendApiKey, otpFromEmail);
    }

    private Mailer logMailer() {
        return (email, codigo) -> log.info("[otp-mail] Código de verificación para {}: {}", email, codigo);
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
