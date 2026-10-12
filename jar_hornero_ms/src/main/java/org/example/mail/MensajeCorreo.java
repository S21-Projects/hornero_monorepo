package org.example.mail;

/**
 * One outgoing email, already rendered by a template class. The body may carry secrets (reset
 * link, one-time code), so {@link #toString()} deliberately omits it: a stray {@code log.info(m)}
 * must not leak it.
 */
public record MensajeCorreo(String to, String subject, String html, String text) {

    @Override
    public String toString() {
        return "MensajeCorreo[subject=" + subject + "]";
    }
}
