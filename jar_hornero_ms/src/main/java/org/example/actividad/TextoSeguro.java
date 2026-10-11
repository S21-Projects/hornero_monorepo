package org.example.actividad;

import java.util.regex.Pattern;

/**
 * Log-injection defence (ASVS 16.4.1) for every free-text value that reaches the activity log or a
 * technical log line: control characters (including CR/LF and tab), Unicode line/paragraph
 * separators and invisible "format" characters (bidi overrides, zero-width) become a single space,
 * runs of whitespace collapse, and the result is truncated to the column size.
 */
public final class TextoSeguro {

    private static final Pattern IP_VALIDA = Pattern.compile("^[0-9a-fA-F:.]{2,45}$");

    private TextoSeguro() {
    }

    /** Returns {@code null} for null or blank input. */
    public static String limpiar(String valor, int max) {
        if (valor == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder(Math.min(valor.length(), max));
        boolean ultimoEspacio = false;
        for (int i = 0; i < valor.length(); i++) {
            char c = valor.charAt(i);
            boolean separador = Character.isISOControl(c)
                    || Character.isWhitespace(c)
                    || Character.isSpaceChar(c)
                    || Character.getType(c) == Character.FORMAT
                    || c == ' ' || c == ' ' || c == '\u0085';
            if (separador) {
                if (!ultimoEspacio && sb.length() > 0) {
                    sb.append(' ');
                    ultimoEspacio = true;
                }
            } else {
                sb.append(c);
                ultimoEspacio = false;
            }
        }
        String limpio = sb.toString().trim();
        if (limpio.isEmpty()) {
            return null;
        }
        return limpio.length() > max ? limpio.substring(0, max) : limpio;
    }

    /**
     * Accepts only something that looks like an IPv4/IPv6 literal. The address arrives in a header,
     * so anything else (a forged value, an injection attempt) is dropped rather than stored.
     */
    public static String ipONull(String valor) {
        if (valor == null) {
            return null;
        }
        String v = valor.trim();
        return IP_VALIDA.matcher(v).matches() ? v : null;
    }
}
