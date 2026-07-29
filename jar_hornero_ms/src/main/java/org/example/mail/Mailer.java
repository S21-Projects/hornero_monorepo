package org.example.mail;

/**
 * Mail transport seam for OTP delivery. The rest of the app depends on this
 * interface, never on a concrete provider — mirrors the pattern already used
 * in {@code ts_hornero_astro/src/lib/mailer.ts}.
 */
public interface Mailer {

    void enviarOtp(String email, String codigo);
}
