package org.example.auditoria;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

/**
 * Read-only verifier of the audit hash chain (C4). It never writes: a broken chain is reported, not
 * repaired.
 *
 * <p>Streams the table in keyset pages ordered by {@code (organizacion_id, id)} (default 1000 rows
 * per page), so memory stays bounded however many events exist: only the current page and the state
 * of one chain are held. For every row it checks, in this order, that the link matches the previous
 * row ({@code ENLACE}: catches deleted, inserted and reordered rows) and that the stored hash equals
 * the recomputed one ({@code CONTENIDO}: catches an edited column). After a defect the walk
 * resynchronizes on the stored hash, so one tampered row yields one report, not a cascade.
 *
 * <p>What it cannot see from inside the table: deleting the last events of a chain leaves a
 * consistent shorter chain. That is what the anchor is for: {@link Resultado#raiz()} digests the
 * head of every chain, so a truncated tail changes the root published the day before.
 */
@Component
public class VerificadorCadena {

    private static final int PAGINA_POR_DEFECTO = 1000;

    private final JdbcTemplate jdbc;
    private final CadenaEventos cadena;
    private final int pagina;

    @Autowired
    public VerificadorCadena(JdbcTemplate jdbc, CadenaEventos cadena) {
        this.jdbc = jdbc;
        this.cadena = cadena;
        this.pagina = PAGINA_POR_DEFECTO;
    }

    /** Test seam: a small page size to exercise the paging. */
    VerificadorCadena(JdbcTemplate jdbc, int pagina) {
        this.jdbc = jdbc;
        this.cadena = null;
        this.pagina = pagina;
    }

    CadenaEventos cadena() {
        return cadena;
    }

    /**
     * @param eventos     rows scanned
     * @param cadenas     organizations with at least one event
     * @param pendientes  rows without hash after the last sealed one of their chain (backfill not run yet)
     * @param primerIdRoto smallest id at which a defect was found, or null
     * @param motivo      {@code ENLACE}, {@code CONTENIDO} or {@code SIN_SELLAR} for that first defect
     * @param incidencias number of defects found
     * @param ultimoId    id of the newest sealed event (null when there is none)
     * @param ultimoHash  its hash
     * @param raiz        SHA-256 over the head of every chain, in organization order
     */
    public record Resultado(boolean integra, long eventos, long cadenas, long pendientes, Long primerIdRoto,
                            String motivo, int incidencias, Long ultimoId, String ultimoHash, String raiz) {
    }

    @Transactional(readOnly = true)
    public Resultado verificar() {
        MessageDigest raiz = CadenaHash.nuevoDigest();
        long eventos = 0;
        long cadenas = 0;
        long pendientes = 0;
        int incidencias = 0;
        Long primerId = null;
        String primerMotivo = null;
        Long ultimoId = null;
        String ultimoHash = null;

        long orgActual = Long.MIN_VALUE;
        String esperado = CadenaHash.GENESIS;
        Long cabezaId = null;
        String cabezaHash = null;
        Long primerSinSellar = null;
        long sinSellar = 0;

        long cursorOrg = Long.MIN_VALUE;
        long cursorId = Long.MIN_VALUE;
        while (true) {
            List<FilaEvento> filas = jdbc.query("select " + FilaEvento.COLUMNAS + " from organizacion_evento "
                    + "where organizacion_id > ? or (organizacion_id = ? and id > ?) "
                    + "order by organizacion_id, id limit " + pagina,
                    FilaEvento.MAPPER, cursorOrg, cursorOrg, cursorId);
            if (filas.isEmpty()) {
                break;
            }
            for (FilaEvento f : filas) {
                long org = f.contenido().organizacionId();
                if (org != orgActual) {
                    if (cabezaHash != null) {
                        cabeza(raiz, orgActual, cabezaId, cabezaHash);
                    }
                    pendientes += sinSellar;
                    sinSellar = 0;
                    orgActual = org;
                    cadenas++;
                    esperado = CadenaHash.GENESIS;
                    cabezaId = null;
                    cabezaHash = null;
                    primerSinSellar = null;
                }
                eventos++;
                cursorOrg = org;
                cursorId = f.id();

                if (f.hash() == null || f.prevHash() == null) {
                    sinSellar++;
                    if (primerSinSellar == null) {
                        primerSinSellar = f.id();
                    }
                    continue;
                }
                String motivo = null;
                if (primerSinSellar != null) {
                    // A sealed row after an unsealed one cannot come from the backfill: it is a hole.
                    sinSellar = 0;
                    incidencias++;
                    if (primerId == null || primerSinSellar < primerId) {
                        primerId = primerSinSellar;
                        primerMotivo = "SIN_SELLAR";
                    }
                    primerSinSellar = null;
                } else if (!f.prevHash().equals(esperado)) {
                    motivo = "ENLACE";
                } else if (!CadenaHash.hash(f.prevHash(), f.contenido()).equals(f.hash())) {
                    motivo = "CONTENIDO";
                }
                if (motivo != null) {
                    incidencias++;
                    if (primerId == null || f.id() < primerId) {
                        primerId = f.id();
                        primerMotivo = motivo;
                    }
                }
                esperado = f.hash();
                cabezaId = f.id();
                cabezaHash = f.hash();
                if (ultimoId == null || f.id() > ultimoId) {
                    ultimoId = f.id();
                    ultimoHash = f.hash();
                }
            }
        }
        if (cabezaHash != null) {
            cabeza(raiz, orgActual, cabezaId, cabezaHash);
        }
        pendientes += sinSellar;
        return new Resultado(incidencias == 0, eventos, cadenas, pendientes, primerId, primerMotivo, incidencias,
                ultimoId, ultimoHash, HexFormat.of().formatHex(raiz.digest()));
    }

    private static void cabeza(MessageDigest raiz, long orgId, Long id, String hash) {
        raiz.update((orgId + ":" + id + ":" + hash + "\n").getBytes(java.nio.charset.StandardCharsets.US_ASCII));
    }
}
