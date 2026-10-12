package org.example.actividad;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Connection;

/**
 * M6: on PostgreSQL the {@code actividad} table is guarded by a trigger (V004) that rejects every
 * UPDATE and every DELETE unless the transaction-local setting {@code hornero.purga_actividad} is
 * {@code 'on'}. The retention job calls {@link #habilitar()} as the first statement of its own
 * transaction; {@code set_config(..., true)} is the function form of {@code SET LOCAL}, so the
 * permission disappears at commit or rollback and can never leak to a pooled connection's next use.
 * On any other database (H2 in tests) there is no trigger and this is a no-op.
 */
@Component
@RequiredArgsConstructor
public class ActividadPurgaHabilitacion {

    private final JdbcTemplate jdbcTemplate;

    /** Must run inside the purge transaction, before the delete. */
    public void habilitar() {
        if (esPostgres()) {
            jdbcTemplate.queryForObject("SELECT set_config('hornero.purga_actividad', 'on', true)", String.class);
        }
    }

    private boolean esPostgres() {
        try (Connection connection = jdbcTemplate.getDataSource().getConnection()) {
            return "PostgreSQL".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName());
        } catch (Exception e) {
            throw new IllegalStateException("cannot detect the database product", e);
        }
    }
}
