package org.example.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * AD-13's runtime guard, PostgreSQL-only. At boot, checks whether
 * {@code scripts/sql/V001__donaciones_necesidad_id_nullable.sql} has already run by reading
 * {@code information_schema.columns.is_nullable} for {@code donaciones.necesidad_id}. If the
 * column is still {@code NOT NULL}, logs an {@code ERROR} naming the script and flips
 * {@link #necesidadIdEsNullable()} to {@code false} so
 * {@code DonacionService.crear(FONDO_COMUN)} can answer {@code 503 ESQUEMA_PENDIENTE} instead of
 * a raw constraint-violation {@code 500}. {@code DIRECTA} creation never consults this flag and
 * keeps working regardless.
 *
 * <p>The check is skipped entirely on any non-PostgreSQL database (every MS test suite runs
 * against H2), so the default state before this runner executes — and always, on H2 — is the
 * permissive {@code true}: this guard fails open, never fail-fast-at-boot (see AD-13's rejected
 * alternatives — a forgotten script must not turn into a full outage).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EsquemaVerificador implements ApplicationRunner {

    private static final String POSTGRES_PRODUCT_NAME = "PostgreSQL";

    private static final String CHECK_NECESIDAD_ID_NULLABLE_SQL = """
            SELECT is_nullable FROM information_schema.columns
            WHERE table_name = 'donaciones' AND column_name = 'necesidad_id'
            """;

    private final JdbcTemplate jdbcTemplate;

    private final AtomicBoolean necesidadIdNullable = new AtomicBoolean(true);

    @Override
    public void run(ApplicationArguments args) throws Exception {
        if (!esPostgres()) {
            return;
        }
        String isNullable = jdbcTemplate.queryForObject(CHECK_NECESIDAD_ID_NULLABLE_SQL, String.class);
        if ("NO".equalsIgnoreCase(isNullable)) {
            necesidadIdNullable.set(false);
            log.error("ESQUEMA_PENDIENTE: donaciones.necesidad_id is still NOT NULL. Run "
                    + "scripts/sql/V001__donaciones_necesidad_id_nullable.sql before creating "
                    + "FONDO_COMUN donations (DIRECTA is unaffected).");
        } else {
            necesidadIdNullable.set(true);
        }
    }

    public boolean necesidadIdEsNullable() {
        return necesidadIdNullable.get();
    }

    private boolean esPostgres() throws Exception {
        try (Connection connection = jdbcTemplate.getDataSource().getConnection()) {
            String productName = connection.getMetaData().getDatabaseProductName();
            return POSTGRES_PRODUCT_NAME.equalsIgnoreCase(productName);
        }
    }
}
