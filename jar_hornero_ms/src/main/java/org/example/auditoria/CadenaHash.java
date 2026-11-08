package org.example.auditoria;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;

/**
 * Canonical encoding and hash of one {@code organizacion_evento} row.
 *
 * <p>{@code hash = hex(SHA-256(prev_hash || canonical))}, where {@code prev_hash} is the 64
 * lowercase hex characters of the previous event of the same organization ({@link #GENESIS} for the
 * first) and {@code canonical} is {@link #canonico}: the version tag, then every field in a fixed
 * order, each as {@code 0x00} when null or {@code 0x01 + 4-byte big-endian length + UTF-8 bytes}.
 * Length prefixes make the encoding unambiguous (moving text across a field boundary changes the
 * bytes) and keep null distinct from the empty string.
 *
 * <p>Timestamps are rendered in UTC with exactly six fractional digits and truncated to
 * microseconds first, because that is what PostgreSQL stores: the value hashed at insert time is
 * the value read back later, whatever the JVM time zone is. The row {@code id} is deliberately not
 * part of the content (it does not exist before the insert); the order of the chain is the order of
 * the ids, and a deleted or reordered row breaks the link of its successor.
 */
public final class CadenaHash {

    public static final String GENESIS = "0".repeat(64);

    static final String VERSION = "HORNERO-EVENTO-V1";

    private static final DateTimeFormatter MICROS =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'").withZone(ZoneOffset.UTC);

    private CadenaHash() {
    }

    /** The audited content of one event. Enums travel as their names. */
    public record Contenido(long organizacionId, String tipo, Instant ocurridoEn, Long actorUsuarioId,
                            String actorTipo, String nivelAntes, String nivelDespues, String requisito,
                            Long evidenciaId, String motivo, String payload) {
    }

    public static byte[] canonico(Contenido c) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.writeBytes(VERSION.getBytes(StandardCharsets.UTF_8));
        campo(out, Long.toString(c.organizacionId()));
        campo(out, c.tipo());
        campo(out, c.ocurridoEn() == null ? null : MICROS.format(c.ocurridoEn().truncatedTo(ChronoUnit.MICROS)));
        campo(out, c.actorUsuarioId() == null ? null : Long.toString(c.actorUsuarioId()));
        campo(out, c.actorTipo());
        campo(out, c.nivelAntes());
        campo(out, c.nivelDespues());
        campo(out, c.requisito());
        campo(out, c.evidenciaId() == null ? null : Long.toString(c.evidenciaId()));
        campo(out, c.motivo());
        campo(out, c.payload());
        return out.toByteArray();
    }

    public static String hash(String prevHash, Contenido contenido) {
        MessageDigest digest = nuevoDigest();
        digest.update(prevHash.getBytes(StandardCharsets.US_ASCII));
        digest.update(canonico(contenido));
        return HexFormat.of().formatHex(digest.digest());
    }

    static MessageDigest nuevoDigest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is mandatory in every JVM", e);
        }
    }

    private static void campo(ByteArrayOutputStream out, String valor) {
        if (valor == null) {
            out.write(0);
            return;
        }
        byte[] bytes = valor.getBytes(StandardCharsets.UTF_8);
        out.write(1);
        out.write(bytes.length >>> 24);
        out.write(bytes.length >>> 16);
        out.write(bytes.length >>> 8);
        out.write(bytes.length);
        out.writeBytes(bytes);
    }
}
