package org.example.auth;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Password policy applied wherever a password is SET (registration today).
 *
 * <p>Follows NIST SP 800-63B-4 3.1.1.2 (single-factor passwords) and OWASP ASVS 5.0 V6.2:
 * <ul>
 *   <li>length 15..64 characters, counted as Unicode code points (NIST: min 15, allow &gt;= 64);</li>
 *   <li>at most 72 UTF-8 bytes, the BCrypt input limit: rejected instead of silently truncated;</li>
 *   <li>no composition rules (no required digit/symbol/case); spaces and any Unicode allowed;</li>
 *   <li>blocklist of common/breached passwords (bundled resource, case-insensitive exact match);</li>
 *   <li>service-specific derivatives: contains the email local part or the user's name (each when
 *       &gt;= 4 chars, accent- and case-insensitive) or "hornero";</li>
 *   <li>trivially repetitive or sequential strings ("aaaa...", "abcabc...", "123456789012345").</li>
 * </ul>
 * The password is never trimmed or altered. Failures are 400 {@link ResponseStatusException}s whose
 * reason is a stable code the clients map to Spanish copy.
 */
@Component
public class PasswordPolicy {

    static final int MIN_CODE_POINTS = 15;
    static final int MAX_CODE_POINTS = 64;
    static final int MAX_UTF8_BYTES = 72;
    private static final int MIN_CONTEXT_TOKEN = 4;
    private static final int MAX_REPEAT_UNIT = 4;
    private static final String BLOCKLIST_RESOURCE = "security/common-passwords.txt";
    private static final String[] SERVICE_TERMS = {"hornero", "elhornero"};
    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private final Set<String> blocklist;

    public PasswordPolicy() {
        this.blocklist = loadBlocklist();
    }

    public int blocklistSize() {
        return blocklist.size();
    }

    /**
     * @param email  the account email (nullable); its local part is a forbidden substring
     * @param nombre the account display name (nullable); the full name and each word are forbidden
     */
    public void validate(String password, String email, String nombre) {
        if (password == null) {
            throw reject("PASSWORD_DEMASIADO_CORTA");
        }
        int codePoints = password.codePointCount(0, password.length());
        if (codePoints < MIN_CODE_POINTS) {
            throw reject("PASSWORD_DEMASIADO_CORTA");
        }
        if (codePoints > MAX_CODE_POINTS
                || password.getBytes(StandardCharsets.UTF_8).length > MAX_UTF8_BYTES) {
            throw reject("PASSWORD_DEMASIADO_LARGA");
        }
        String folded = fold(password);
        if (blocklist.contains(password.toLowerCase(Locale.ROOT)) || blocklist.contains(folded)
                || isTriviallyPredictable(folded)) {
            throw reject("PASSWORD_COMUN");
        }
        if (containsPersonalData(folded, email, nombre)) {
            throw reject("PASSWORD_CONTIENE_DATOS_PERSONALES");
        }
    }

    private static boolean containsPersonalData(String foldedPassword, String email, String nombre) {
        String compact = WHITESPACE.matcher(foldedPassword).replaceAll("");
        for (String term : SERVICE_TERMS) {
            if (compact.contains(term)) {
                return true;
            }
        }
        if (email != null) {
            int at = email.indexOf('@');
            String local = fold(at >= 0 ? email.substring(0, at) : email);
            if (local.length() >= MIN_CONTEXT_TOKEN && compact.contains(local)) {
                return true;
            }
        }
        if (nombre != null) {
            String foldedNombre = fold(nombre.trim());
            String fullName = WHITESPACE.matcher(foldedNombre).replaceAll("");
            if (fullName.length() >= MIN_CONTEXT_TOKEN && compact.contains(fullName)) {
                return true;
            }
            for (String token : WHITESPACE.split(foldedNombre)) {
                if (token.length() >= MIN_CONTEXT_TOKEN && compact.contains(token)) {
                    return true;
                }
            }
        }
        return false;
    }

    /** One distinct character, a short unit repeated end to end, or a +1/-1 sequence. */
    private static boolean isTriviallyPredictable(String s) {
        int[] cps = s.codePoints().toArray();
        return isRepeatedUnit(cps) || isSequence(cps, 1) || isSequence(cps, -1);
    }

    private static boolean isRepeatedUnit(int[] cps) {
        for (int unit = 1; unit <= MAX_REPEAT_UNIT && unit <= cps.length / 2; unit++) {
            boolean repeats = true;
            for (int i = unit; i < cps.length && repeats; i++) {
                repeats = cps[i] == cps[i - unit];
            }
            if (repeats) {
                return true;
            }
        }
        return false;
    }

    /** Digits wrap 9 to 0 and letters wrap z to a, so "...7890123" and "...xyzabc" count. */
    private static boolean isSequence(int[] cps, int step) {
        for (int i = 1; i < cps.length; i++) {
            if (next(cps[i - 1], step) != cps[i]) {
                return false;
            }
        }
        return true;
    }

    private static int next(int cp, int step) {
        if (cp >= '0' && cp <= '9') {
            return '0' + Math.floorMod(cp - '0' + step, 10);
        }
        if (cp >= 'a' && cp <= 'z') {
            return 'a' + Math.floorMod(cp - 'a' + step, 26);
        }
        return -1;
    }

    /** Lowercase and strip diacritics so "LUCÍA" matches "lucia". */
    private static String fold(String value) {
        String decomposed = Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD);
        return DIACRITICS.matcher(decomposed).replaceAll("");
    }

    private static ResponseStatusException reject(String code) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, code);
    }

    private static Set<String> loadBlocklist() {
        Set<String> entries = new HashSet<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new ClassPathResource(BLOCKLIST_RESOURCE).getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.isEmpty() && line.charAt(0) != '#') {
                    entries.add(line.toLowerCase(Locale.ROOT));
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot load password blocklist " + BLOCKLIST_RESOURCE, e);
        }
        return Set.copyOf(entries);
    }
}
