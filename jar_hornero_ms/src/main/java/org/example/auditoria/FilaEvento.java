package org.example.auditoria;

import org.springframework.jdbc.core.RowMapper;

import java.time.OffsetDateTime;

/** One {@code organizacion_evento} row as stored, read with plain JDBC (no entity, no session cache). */
record FilaEvento(long id, CadenaHash.Contenido contenido, String prevHash, String hash) {

    static final String COLUMNAS = "id, organizacion_id, tipo, ocurrido_en, actor_usuario_id, actor_tipo, "
            + "nivel_antes, nivel_despues, requisito, evidencia_id, motivo, payload, prev_hash, hash";

    static final RowMapper<FilaEvento> MAPPER = (rs, n) -> {
        OffsetDateTime ocurrido = rs.getObject("ocurrido_en", OffsetDateTime.class);
        long actor = rs.getLong("actor_usuario_id");
        Long actorId = rs.wasNull() ? null : actor;
        long evidencia = rs.getLong("evidencia_id");
        Long evidenciaId = rs.wasNull() ? null : evidencia;
        return new FilaEvento(
                rs.getLong("id"),
                new CadenaHash.Contenido(rs.getLong("organizacion_id"), rs.getString("tipo"),
                        ocurrido == null ? null : ocurrido.toInstant(), actorId, rs.getString("actor_tipo"),
                        rs.getString("nivel_antes"), rs.getString("nivel_despues"), rs.getString("requisito"),
                        evidenciaId, rs.getString("motivo"), rs.getString("payload")),
                rs.getString("prev_hash"), rs.getString("hash"));
    };
}
