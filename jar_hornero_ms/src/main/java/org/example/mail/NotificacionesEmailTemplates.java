package org.example.mail;

import org.example.actividad.TextoSeguro;
import org.example.domain.NivelAcreditacion;
import org.example.domain.RequisitoAcreditacion;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * N13/D6: subject + body of every notification email. Spanish copy, neutral tone, plain HTML and
 * text. All of them link to the panel and NONE carries a secret (no token, no delivery code): a
 * notification only says that something happened and where to look. Every dynamic value is
 * user-provided text (names, observations), so it is HTML-escaped in the body and stripped of line
 * breaks in the subject (header injection).
 */
public final class NotificacionesEmailTemplates {

    /** Longest list a message shows; the rest is summarized as "y N más". */
    static final int MAX_LINEAS = 20;

    private NotificacionesEmailTemplates() {
    }

    // --- donante -------------------------------------------------------------------------------

    public static MensajeCorreo donacionAceptada(String to, String nombre, String organizacion,
                                                 List<String> articulos, String enlace) {
        return armar(to, organizacion + " aceptó tu donación", nombre,
                List.of("¡Buenas noticias! " + organizacion + " aceptó tu donación."),
                List.of(new Seccion("Lo que ofreciste", articulos.size(), articulos)),
                "Ver mi donación", enlace,
                "Coordiná la entrega desde el panel.");
    }

    public static MensajeCorreo donacionRechazada(String to, String nombre, String organizacion, String enlace) {
        return armar(to, "Tu donación no fue aceptada", nombre,
                List.of(organizacion + " no pudo aceptar tu donación esta vez. Podés ofrecerla a otra organización desde el panel."),
                List.of(), "Ver mi donación", enlace, null);
    }

    public static MensajeCorreo donacionVencida(String to, String nombre, String organizacion, int dias,
                                                String enlace) {
        return armar(to, "Tu donación fue cancelada por falta de respuesta", nombre,
                List.of(organizacion + " no respondió tu oferta en " + dias + " días, por eso la cancelamos automáticamente.",
                        "Si querés, podés volver a ofrecerla desde el panel."),
                List.of(), "Ver mi donación", enlace, null);
    }

    public static MensajeCorreo entregaConfirmada(String to, String nombre, String organizacion, String enlace) {
        return armar(to, "Entrega confirmada: gracias por donar", nombre,
                List.of("La entrega de tu donación a " + organizacion + " quedó confirmada por ambas partes. ¡Gracias!"),
                List.of(), "Ver mi donación", enlace, null);
    }

    // --- referente -----------------------------------------------------------------------------

    public static MensajeCorreo ofertaRecibida(String to, String nombre, String organizacion, String donante,
                                               List<String> articulos, String enlace) {
        return armar(to, "Nueva donación para " + organizacion, nombre,
                List.of(donante + " ofreció una donación a " + organizacion + ". Aceptala o rechazala desde el panel."),
                List.of(new Seccion("Artículos ofrecidos", articulos.size(), articulos)),
                "Responder la oferta", enlace, null);
    }

    /**
     * One email per referente per ronda. {@code total} is the number of donations proposed;
     * {@code lineas} one summary line per organization (capped on display).
     */
    public static MensajeCorreo propuestasRonda(String to, String nombre, int total, List<String> lineas,
                                                String enlace) {
        String asunto = total == 1 ? "Tenés 1 donación propuesta para responder"
                : "Tenés " + total + " donaciones propuestas para responder";
        return armar(to, asunto, nombre,
                List.of("Una ronda de asignación propuso " + (total == 1 ? "1 donación" : total + " donaciones")
                        + " a tus organizaciones. Revisalas y respondé desde el panel."),
                List.of(new Seccion("Organizaciones", lineas.size() < total ? total : lineas.size(), lineas)),
                "Ver las propuestas", enlace, null);
    }

    public static MensajeCorreo organizacionAprobada(String to, String nombre, String organizacion, String enlace) {
        return armar(to, "Tu organización fue aprobada: " + organizacion, nombre,
                List.of("Validamos el registro de " + organizacion + ". Ya podés publicar necesidades y recibir donaciones."),
                List.of(), "Ir al panel", enlace, null);
    }

    public static MensajeCorreo organizacionRechazada(String to, String nombre, String organizacion, String enlace) {
        return armar(to, "Tu organización fue rechazada: " + organizacion, nombre,
                List.of("No pudimos validar el registro de " + organizacion + ".",
                        "Si creés que se trata de un error, escribinos desde el formulario de contacto del sitio."),
                List.of(), "Ir al panel", enlace, null);
    }

    public static MensajeCorreo nivelCambiado(String to, String nombre, String organizacion,
                                              NivelAcreditacion antes, NivelAcreditacion despues, String motivo,
                                              String enlace) {
        boolean sube = despues.compareTo(antes) > 0;
        List<String> parrafos = new ArrayList<>();
        parrafos.add("El nivel de acreditación de " + organizacion + (sube ? " subió" : " bajó") + " de "
                + antes + " (" + antes.getLabel() + ") a " + despues + " (" + despues.getLabel() + ").");
        if (motivo != null && !motivo.isBlank()) {
            parrafos.add("Motivo: " + motivo);
        }
        return armar(to, "Cambió el nivel de " + organizacion, nombre, parrafos, List.of(),
                "Ver la acreditación", enlace, null);
    }

    public static MensajeCorreo evidenciaObservada(String to, String nombre, String organizacion,
                                                   RequisitoAcreditacion requisito, String observacion,
                                                   String enlace) {
        return armar(to, "Una evidencia de " + organizacion + " fue observada", nombre,
                List.of("Un administrador observó la evidencia del requisito «" + legible(requisito)
                        + "» de " + organizacion + ".",
                        "Observación: " + observacion,
                        "Corregila y volvé a enviarla desde el panel."),
                List.of(), "Ver la acreditación", enlace, null);
    }

    // --- administrador -------------------------------------------------------------------------

    /**
     * Daily digest. A section with a zero total is left out entirely; the caller does not send the
     * digest when both are zero.
     */
    public static MensajeCorreo digestAdmin(String to, String nombre, int totalOrganizaciones,
                                            List<String> organizaciones, int totalEstancadas,
                                            List<String> estancadas, String enlaceOrganizaciones,
                                            String enlaceDonaciones) {
        List<Seccion> secciones = new ArrayList<>();
        List<String> parrafos = new ArrayList<>();
        parrafos.add("Este es el resumen diario de pendientes en Hornero.");
        String enlace = enlaceOrganizaciones;
        String boton = "Ir al panel";
        if (totalOrganizaciones > 0) {
            secciones.add(new Seccion("Organizaciones pendientes de validación (" + totalOrganizaciones + ")",
                    totalOrganizaciones, organizaciones));
        }
        if (totalEstancadas > 0) {
            secciones.add(new Seccion("Donaciones estancadas (" + totalEstancadas + ")", totalEstancadas, estancadas));
        }
        String pie = null;
        if (totalOrganizaciones > 0 && totalEstancadas > 0) {
            pie = "Donaciones estancadas: " + enlaceDonaciones;
        } else if (totalEstancadas > 0) {
            enlace = enlaceDonaciones;
        }
        return armar(to, "Resumen diario de Hornero: " + (totalOrganizaciones + totalEstancadas) + " pendientes",
                nombre, parrafos, secciones, boton, enlace, pie, true);
    }

    // --- rendering -----------------------------------------------------------------------------

    private record Seccion(String titulo, int total, List<String> items) {
    }

    private static MensajeCorreo armar(String to, String asunto, String nombre, List<String> parrafos,
                                       List<Seccion> secciones, String boton, String enlace, String nota) {
        return armar(to, asunto, nombre, parrafos, secciones, boton, enlace, nota, false);
    }

    private static MensajeCorreo armar(String to, String asunto, String nombre, List<String> parrafos,
                                       List<Seccion> secciones, String boton, String enlace, String nota,
                                       boolean notaEsEnlace) {
        String subject = TextoSeguro.limpiar(asunto, 200);
        StringBuilder text = new StringBuilder("Hola " + plano(nombre) + ",\n\n");
        StringBuilder html = new StringBuilder("<div style=\"font-family: sans-serif; max-width: 480px; margin: 0 auto;\">\n")
                .append("  <h2>Hola ").append(esc(nombre)).append(",</h2>\n");
        for (String p : parrafos) {
            text.append(plano(p)).append("\n\n");
            html.append("  <p>").append(esc(p)).append("</p>\n");
        }
        for (Seccion s : secciones) {
            text.append(plano(s.titulo())).append(":\n");
            html.append("  <h3 style=\"font-size: 15px;\">").append(esc(s.titulo())).append("</h3>\n  <ul>\n");
            int mostrados = Math.min(s.items().size(), MAX_LINEAS);
            for (int i = 0; i < mostrados; i++) {
                text.append("- ").append(plano(s.items().get(i))).append('\n');
                html.append("    <li>").append(esc(s.items().get(i))).append("</li>\n");
            }
            int mas = s.total() - mostrados;
            if (mas > 0) {
                text.append("... y ").append(mas).append(" más\n");
                html.append("    <li>… y ").append(mas).append(" más</li>\n");
            }
            text.append('\n');
            html.append("  </ul>\n");
        }
        text.append(boton).append(": ").append(enlace).append("\n\n");
        html.append("  <p><a href=\"").append(esc(enlace)).append("\" style=\"display: inline-block; padding: 10px 18px; ")
                .append("background: #b45309; color: #ffffff; text-decoration: none; border-radius: 6px;\">")
                .append(esc(boton)).append("</a></p>\n");
        if (nota != null) {
            text.append(plano(nota)).append("\n\n");
            if (notaEsEnlace) {
                String url = nota.substring(nota.lastIndexOf(' ') + 1);
                html.append("  <p>").append(esc(nota.substring(0, nota.lastIndexOf(' ') + 1)))
                        .append("<a href=\"").append(esc(url)).append("\">").append(esc(url)).append("</a></p>\n");
            } else {
                html.append("  <p>").append(esc(nota)).append("</p>\n");
            }
        }
        text.append("— El equipo de Hornero\n");
        html.append("  <p style=\"font-size: 13px; color: #6b7280;\">Recibís este correo porque tenés una cuenta en Hornero.</p>\n")
                .append("  <p>— El equipo de Hornero</p>\n</div>\n");
        return new MensajeCorreo(to, subject, html.toString(), text.toString());
    }

    private static String legible(RequisitoAcreditacion requisito) {
        String s = requisito.name().replace('_', ' ').toLowerCase(Locale.ROOT);
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    /** Plain-text body: user text on one line (no injected extra lines). */
    private static String plano(String s) {
        String limpio = TextoSeguro.limpiar(s, 2000);
        return limpio == null ? "" : limpio;
    }

    private static String esc(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
