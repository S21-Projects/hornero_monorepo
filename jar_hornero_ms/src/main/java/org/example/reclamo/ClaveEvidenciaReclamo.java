package org.example.reclamo;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The shape of a claim evidence object key: {@code reclamo-evidencia/{orgId}/{userId}/{file}}.
 * One definition shared by claim validation, evidence authorization and evidence deletion, so the
 * copies cannot drift.
 */
public final class ClaveEvidenciaReclamo {

    public static final String PREFIJO = "reclamo-evidencia/";
    public static final Pattern PATRON = Pattern.compile("^reclamo-evidencia/(\\d+)/(\\d+)/[^/]+$");

    private ClaveEvidenciaReclamo() {
    }

    /** The id of the referente that owns the key, or empty when the key does not match the pattern. */
    public static Optional<Long> referenteId(String key) {
        Matcher m = key == null ? null : PATRON.matcher(key);
        if (m == null || !m.matches()) {
            return Optional.empty();
        }
        try {
            return Optional.of(Long.parseLong(m.group(2)));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}
