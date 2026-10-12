package org.example.mail;

/** Notice sent after a completed password reset, so an unexpected change is noticed (OWASP). */
public final class PasswordCambiadaEmailTemplate {

    private PasswordCambiadaEmailTemplate() {
    }

    public static MensajeCorreo mensaje(String to) {
        return new MensajeCorreo(to, "Cambiaste tu contraseña de Hornero", htmlBody(), textBody());
    }

    static String textBody() {
        return """
                ¡Hola!

                La contraseña de tu cuenta de Hornero se cambió hace un momento y cerramos todas tus sesiones abiertas.

                Si fuiste vos, no tenés que hacer nada. Si no reconocés este cambio, restablecé tu contraseña de nuevo desde la pantalla de ingreso y escribinos a través del formulario de contacto.

                — El equipo de Hornero
                """;
    }

    static String htmlBody() {
        return """
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                  <h2>¡Hola!</h2>
                  <p>La contraseña de tu cuenta de Hornero se cambió hace un momento y cerramos todas tus sesiones abiertas.</p>
                  <p>Si fuiste vos, no tenés que hacer nada. Si no reconocés este cambio, restablecé tu contraseña de nuevo desde la pantalla de ingreso y escribinos a través del formulario de contacto.</p>
                  <p>— El equipo de Hornero</p>
                </div>
                """;
    }
}
