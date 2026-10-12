package org.example.notificacion;

import org.example.mail.MensajeCorreo;

/**
 * One rendered notification ready to send. {@code plantilla} names the template (for the failure
 * record), {@code entidadTipo}/{@code entidadId} the domain object it is about.
 */
record Envio(String plantilla, MensajeCorreo mensaje, String entidadTipo, Long entidadId) {
}
