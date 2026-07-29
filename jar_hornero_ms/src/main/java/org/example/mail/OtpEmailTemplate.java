package org.example.mail;

/**
 * Subject + body for the OTP verification email. Spanish copy, no template
 * engine (no Thymeleaf dependency in this project) — plain Java text blocks.
 */
public final class OtpEmailTemplate {

    private OtpEmailTemplate() {
    }

    public static String subject() {
        return "Tu código de verificación de Hornero";
    }

    public static String textBody(String codigo) {
        return """
                ¡Hola!

                Tu código de verificación es: %s

                Este código vence en 15 minutos. Si no solicitaste este código, podés ignorar este correo.

                — El equipo de Hornero
                """.formatted(codigo);
    }

    public static String htmlBody(String codigo) {
        return """
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                  <h2>¡Hola!</h2>
                  <p>Tu código de verificación es:</p>
                  <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">%s</p>
                  <p>Este código vence en 15 minutos. Si no solicitaste este código, podés ignorar este correo.</p>
                  <p>— El equipo de Hornero</p>
                </div>
                """.formatted(codigo);
    }
}
