package org.example.auditoria;

import lombok.extern.slf4j.Slf4j;
import org.example.domain.OrganizacionEvento;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

/**
 * Writer side of the audit hash chain (C4). One chain per organization: the events of one
 * organization are hashed in id order, each one over the hash of the previous one.
 *
 * <h3>Why per organization, and why it cannot fork</h3>
 * Events are inserted from concurrent transactions. A global chain would serialize every writer in
 * the system for the whole of its transaction. A per-organization chain only needs the writers of
 * the same organization to queue, and two decisions about one organization are exactly the ones
 * that must be ordered anyway. {@link #sellar} first takes a row lock on the organization
 * ({@code SELECT ... FOR UPDATE}), which is held until the caller's transaction ends, then reads
 * the head of the chain and links to it. Under READ COMMITTED the second writer's head read happens
 * after the first one committed, so it sees the new head. As a second barrier the unique index on
 * {@code (organizacion_id, prev_hash)} makes a fork (two children of one event) impossible even if
 * a future writer forgot the lock: the second insert fails instead of forking the chain.
 */
@Slf4j
@Component
public class CadenaEventos {

    private static final int PAGINA = 500;

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaccion;

    public CadenaEventos(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.transaccion = new TransactionTemplate(transactionManager);
    }

    /** Computes and stamps {@code prev_hash} and {@code hash}. Must run inside the inserting transaction. */
    public void sellar(OrganizacionEvento evento) {
        long orgId = evento.getOrganizacion().getId();
        bloquear(orgId);
        String prev = cabeza(orgId);
        String hash = CadenaHash.hash(prev, new CadenaHash.Contenido(
                orgId, evento.getTipo().name(), evento.getOcurridoEn(), evento.getActorUsuarioId(),
                evento.getActorTipo(), nombre(evento.getNivelAntes()), nombre(evento.getNivelDespues()),
                nombre(evento.getRequisito()), evento.getEvidenciaId(), evento.getMotivo(), evento.getPayload()));
        evento.sellar(prev, hash);
    }

    private static String nombre(Enum<?> valor) {
        return valor == null ? null : valor.name();
    }

    private void bloquear(long orgId) {
        jdbc.queryForList("select id from organizaciones where id = ? for update", Long.class, orgId);
    }

    /** Hash of the last event of the organization, sealing legacy rows first if the head has none. */
    private String cabeza(long orgId) {
        String hash = hashDelUltimo(orgId);
        if (hash == null && existenEventos(orgId)) {
            completarOrganizacionBloqueada(orgId);
            hash = hashDelUltimo(orgId);
        }
        return hash == null ? CadenaHash.GENESIS : hash;
    }

    private String hashDelUltimo(long orgId) {
        List<String> r = jdbc.query("select hash from organizacion_evento where organizacion_id = ? "
                + "order by id desc limit 1", (rs, n) -> rs.getString(1), orgId);
        return r.isEmpty() ? null : r.get(0);
    }

    private boolean existenEventos(long orgId) {
        return !jdbc.queryForList("select id from organizacion_evento where organizacion_id = ? limit 1",
                Long.class, orgId).isEmpty();
    }

    /**
     * Seals every row that has no hash yet, in insertion order, one organization per transaction.
     * Idempotent (a sealed row is never touched) and resumable (a crash leaves whole organizations
     * either sealed or not). Returns how many rows it sealed.
     */
    public int completarPendientes() {
        int total = 0;
        long ultima = Long.MIN_VALUE;
        while (true) {
            final long desde = ultima;
            List<Long> siguiente = jdbc.queryForList("select distinct organizacion_id from organizacion_evento "
                    + "where hash is null and organizacion_id > ? order by organizacion_id limit 1", Long.class, desde);
            if (siguiente.isEmpty()) {
                return total;
            }
            long orgId = siguiente.get(0);
            Integer sellados = transaccion.execute(status -> {
                bloquear(orgId);
                return completarOrganizacionBloqueada(orgId);
            });
            total += sellados == null ? 0 : sellados;
            ultima = orgId;
        }
    }

    /** Caller holds the organization lock. Only rows after the last sealed one are sealed. */
    private int completarOrganizacionBloqueada(long orgId) {
        long desdeId = 0;
        String prev = CadenaHash.GENESIS;
        List<FilaEvento> cabeza = jdbc.query("select " + FilaEvento.COLUMNAS + " from organizacion_evento "
                + "where organizacion_id = ? and hash is not null order by id desc limit 1", FilaEvento.MAPPER, orgId);
        if (!cabeza.isEmpty()) {
            desdeId = cabeza.get(0).id();
            prev = cabeza.get(0).hash();
        }
        int sellados = 0;
        while (true) {
            List<FilaEvento> pagina = jdbc.query("select " + FilaEvento.COLUMNAS + " from organizacion_evento "
                    + "where organizacion_id = ? and id > ? and hash is null order by id limit " + PAGINA,
                    FilaEvento.MAPPER, orgId, desdeId);
            if (pagina.isEmpty()) {
                break;
            }
            for (FilaEvento fila : pagina) {
                String hash = CadenaHash.hash(prev, fila.contenido());
                jdbc.update("update organizacion_evento set prev_hash = ?, hash = ? where id = ? and hash is null",
                        prev, hash, fila.id());
                prev = hash;
                desdeId = fila.id();
                sellados++;
            }
        }
        if (sellados > 0) {
            log.info("[auditoria] sealed {} legacy event(s) of organizacion {}", sellados, orgId);
        }
        return sellados;
    }
}
