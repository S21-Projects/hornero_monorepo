package org.example.common;

import org.springframework.dao.DataIntegrityViolationException;

/** Helpers to tell which database constraint a {@link DataIntegrityViolationException} violated. */
public final class Restricciones {

    private Restricciones() {
    }

    /**
     * True when the exception (or any cause) names the given constraint/index. Matching is by name,
     * case-insensitive: PostgreSQL and H2 both put the index name in the violation message.
     */
    public static boolean viola(DataIntegrityViolationException e, String constraint) {
        String needle = constraint.toLowerCase();
        for (Throwable t = e; t != null; t = t.getCause() == t ? null : t.getCause()) {
            String m = t.getMessage();
            if (m != null && m.toLowerCase().contains(needle)) {
                return true;
            }
        }
        return false;
    }
}
