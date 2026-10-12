package org.example.mail;

/**
 * Mail transport seam. The rest of the app depends on this interface, never on a concrete
 * provider — mirrors the pattern already used in {@code ts_hornero_astro/src/lib/mailer.ts}.
 * Each message type has its own template class that renders a {@link MensajeCorreo}.
 */
public interface Mailer {

    void enviar(MensajeCorreo mensaje);

    default void enviarOtp(String email, String codigo) {
        enviar(OtpEmailTemplate.mensaje(email, codigo));
    }
}
