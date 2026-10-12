package org.example.mail;

/** Subject + body for the password reset email. Spanish copy, plain Java text blocks. */
public final class PasswordResetEmailTemplate {

    private PasswordResetEmailTemplate() {
    }

    public static MensajeCorreo mensaje(String to, String enlace, long minutosValidez) {
        return new MensajeCorreo(to, subject(), htmlBody(enlace, minutosValidez), textBody(enlace, minutosValidez));
    }

    public static String subject() {
        return "Restablecé tu contraseña de Hornero";
    }

    static String textBody(String enlace, long minutos) {
        return """
                ¡Hola!

                Recibimos un pedido para restablecer la contraseña de tu cuenta. Entrá al siguiente enlace para elegir una nueva:

                %s

                El enlace vence en %d minutos y sólo puede usarse una vez. Si no lo pediste vos, podés ignorar este correo: tu contraseña no cambia.

                — El equipo de Hornero
                """.formatted(enlace, minutos);
    }

    static String htmlBody(String enlace, long minutos) {
        String href = escapar(enlace);
        return """
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                  <h2>¡Hola!</h2>
                  <p>Recibimos un pedido para restablecer la contraseña de tu cuenta.</p>
                  <p><a href="%s" style="display: inline-block; padding: 10px 18px; background: #b45309; color: #ffffff; text-decoration: none; border-radius: 6px;">Elegir una nueva contraseña</a></p>
                  <p style="font-size: 13px;">Si el botón no funciona, copiá este enlace en tu navegador:<br>%s</p>
                  <p>El enlace vence en %d minutos y sólo puede usarse una vez. Si no lo pediste vos, podés ignorar este correo: tu contraseña no cambia.</p>
                  <p>— El equipo de Hornero</p>
                </div>
                """.formatted(href, href, minutos);
    }

    private static String escapar(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
