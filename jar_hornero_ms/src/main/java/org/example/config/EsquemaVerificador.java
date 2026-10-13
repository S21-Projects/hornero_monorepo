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

    /**
     * V003 (N11): {@code ddl-auto=update} adds the {@code @Version} columns as nullable, leaving
     * existing rows NULL until the script sets them to 0. Lists the tables that still hold NULLs.
     */
    private static final String CHECK_VERSIONES_PENDIENTES_SQL = """
            SELECT 'donaciones' WHERE EXISTS (SELECT 1 FROM donaciones WHERE version IS NULL)
            UNION ALL SELECT 'necesidades' WHERE EXISTS (SELECT 1 FROM necesidades WHERE version IS NULL)
            UNION ALL SELECT 'organizaciones' WHERE EXISTS (SELECT 1 FROM organizaciones WHERE version IS NULL)
            """;

    /**
     * V007: Hibernate-generated CHECK constraints on the STRING enum columns are never widened by
     * ddl-auto=update. Lists the ones that still reject SIN_RECLAMAR / IMPORTADA_RENACOM.
     */
    private static final String CHECK_ORIGEN_CHECKS_PENDIENTES_SQL = """
            SELECT conname FROM pg_constraint
            WHERE contype = 'c'
              AND ((conrelid = to_regclass('organizaciones')
                    AND pg_get_constraintdef(oid) ~ '\\mestado\\M'
                    AND pg_get_constraintdef(oid) NOT LIKE '%SIN_RECLAMAR%')
                OR (conrelid = to_regclass('organizacion_evento')
                    AND pg_get_constraintdef(oid) ~ '\\mtipo\\M'
                    AND pg_get_constraintdef(oid) NOT LIKE '%IMPORTADA_RENACOM%'))
            """;

    /** V008: organizacion_evento.tipo CHECK that still rejects the claim-flow events. */
    private static final String CHECK_RECLAMO_CHECKS_PENDIENTES_SQL = """
            SELECT conname FROM pg_constraint
            WHERE contype = 'c'
              AND conrelid = to_regclass('organizacion_evento')
              AND pg_get_constraintdef(oid) ~ '\\mtipo\\M'
              AND pg_get_constraintdef(oid) NOT LIKE '%RECLAMO_APROBADO%'
            """;

    /** V008: unique partial index on pending claims, only meaningful once the claims table exists. */
    private static final String CHECK_RECLAMO_INDICE_PENDIENTE_SQL = """
            SELECT 'ux_reclamo_pendiente' WHERE to_regclass('reclamos_organizacion') IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ux_reclamo_pendiente')
            """;

    /** V009: organizacion_evento.tipo CHECK that still rejects the report-flow events. */
    private static final String CHECK_REPORTE_CHECKS_PENDIENTES_SQL = """
            SELECT conname FROM pg_constraint
            WHERE contype = 'c'
              AND conrelid = to_regclass('organizacion_evento')
              AND pg_get_constraintdef(oid) ~ '\\mtipo\\M'
              AND pg_get_constraintdef(oid) NOT LIKE '%REPORTE_CONFIRMADO%'
            """;

    /** V009: unique partial index on pending reports, only meaningful once the reports table exists. */
    private static final String CHECK_REPORTE_INDICE_PENDIENTE_SQL = """
            SELECT 'ux_reporte_pendiente' WHERE to_regclass('reportes_organizacion') IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ux_reporte_pendiente')
            """;


    /** V004 (M6): the immutability trigger on {@code actividad}; absent trigger = script pending. */
    private static final String CHECK_ACTIVIDAD_TRIGGER_SQL = """
            SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'actividad_inmutable' AND NOT tgisinternal)
            """;

    /** V005 (N12): rows that predate {@code donaciones.estado_desde} (column added by ddl-auto, NULL). */
    private static final String CHECK_ESTADO_DESDE_PENDIENTE_SQL = """
            SELECT EXISTS (SELECT 1 FROM donaciones WHERE estado_desde IS NULL AND fecha_oferta IS NOT NULL)
            """;

    /**
     * V006 (N15): the trigger function of V004 replaced by the version that lets the retention job
     * clear {@code email_intento}. Detected by the column name appearing in the function body.
     */
    private static final String CHECK_PURGA_EMAIL_INTENTO_SQL = """
            SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'actividad_inmutable' AND prosrc LIKE '%email_intento%')
            """;

    private final AtomicBoolean purgaEmailIntento = new AtomicBoolean(true);
    private final AtomicBoolean estadoDesdeCompleto = new AtomicBoolean(true);
    private final AtomicBoolean actividadInmutable = new AtomicBoolean(true);
    private final AtomicBoolean necesidadIdNullable = new AtomicBoolean(true);
    private final AtomicBoolean versionesInicializadas = new AtomicBoolean(true);
    private final AtomicBoolean origenOrganizacionMigrado = new AtomicBoolean(true);
    private final AtomicBoolean eventosReclamoMigrados = new AtomicBoolean(true);
    private final AtomicBoolean eventosReporteMigrados = new AtomicBoolean(true);

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
        verificarVersiones();
        verificarActividadInmutable();
        verificarEstadoDesde();
        verificarPurgaEmailIntento();
        verificarOrigenOrganizacion();
        verificarEventosReclamo();
        verificarEventosReporte();
    }

    private void verificarEventosReporte() {
        java.util.List<String> pendientes =
                new java.util.ArrayList<>(jdbcTemplate.queryForList(CHECK_REPORTE_CHECKS_PENDIENTES_SQL, String.class));
        java.util.List<String> indice = jdbcTemplate.queryForList(CHECK_REPORTE_INDICE_PENDIENTE_SQL, String.class);
        if (indice != null) pendientes.addAll(indice);
        if (!pendientes.isEmpty()) {
            eventosReporteMigrados.set(false);
            log.error("ESQUEMA_PENDIENTE: CHECK constraints / indexes {} are missing for the REPORTE_CONFIRMADO / "
                    + "REPORTE_DESCARTADO events. Run scripts/sql/V009__reporte_eventos.sql (make migrate) before "
                    + "resolving reports.", pendientes);
        } else {
            eventosReporteMigrados.set(true);
        }
    }

    /** False when V009 has not widened the organizacion_evento CHECK or built the pending-report index. */
    public boolean eventosReporteMigrados() {
        return eventosReporteMigrados.get();
    }

    private void verificarEventosReclamo() {
        java.util.List<String> pendientes =
                new java.util.ArrayList<>(jdbcTemplate.queryForList(CHECK_RECLAMO_CHECKS_PENDIENTES_SQL, String.class));
        java.util.List<String> indice = jdbcTemplate.queryForList(CHECK_RECLAMO_INDICE_PENDIENTE_SQL, String.class);
        if (indice != null) pendientes.addAll(indice);
        if (pendientes != null && !pendientes.isEmpty()) {
            eventosReclamoMigrados.set(false);
            log.error("ESQUEMA_PENDIENTE: CHECK constraints {} reject the RECLAMO_APROBADO / RECLAMO_RECHAZADO "
                    + "events. Run scripts/sql/V008__reclamo_eventos.sql (make migrate) before resolving claims.",
                    pendientes);
        } else {
            eventosReclamoMigrados.set(true);
        }
    }

    /** False when V008 has not widened the organizacion_evento CHECK. Informational; PostgreSQL only. */
    public boolean eventosReclamoMigrados() {
        return eventosReclamoMigrados.get();
    }

    private void verificarPurgaEmailIntento() {
        Boolean presente = jdbcTemplate.queryForObject(CHECK_PURGA_EMAIL_INTENTO_SQL, Boolean.class);
        if (Boolean.FALSE.equals(presente)) {
            purgaEmailIntento.set(false);
            log.error("ESQUEMA_PENDIENTE: the actividad trigger does not allow clearing email_intento. Run "
                    + "scripts/sql/V006__actividad_purga_email_intento.sql (make migrate); until then the 90-day "
                    + "purge of attempted emails fails and logs this error every run.");
        } else {
            purgaEmailIntento.set(true);
        }
    }

    /** False when V006 has not been applied. Informational; PostgreSQL only. */
    public boolean purgaEmailIntentoHabilitada() {
        return purgaEmailIntento.get();
    }

    private void verificarEstadoDesde() {
        Boolean pendiente = jdbcTemplate.queryForObject(CHECK_ESTADO_DESDE_PENDIENTE_SQL, Boolean.class);
        if (Boolean.TRUE.equals(pendiente)) {
            estadoDesdeCompleto.set(false);
            log.error("ESQUEMA_PENDIENTE: donaciones with a NULL estado_desde. Run "
                    + "scripts/sql/V005__donaciones_estado_desde_backfill.sql (make migrate); until then the "
                    + "stale-donations job and the 'estancada' flag fall back to fecha_oferta.");
        } else {
            estadoDesdeCompleto.set(true);
        }
    }

    /** False when V005 has not been applied (NULL estado_desde rows exist). Informational; PostgreSQL only. */
    public boolean estadoDesdeCompleto() {
        return estadoDesdeCompleto.get();
    }

    private void verificarActividadInmutable() {
        Boolean presente = jdbcTemplate.queryForObject(CHECK_ACTIVIDAD_TRIGGER_SQL, Boolean.class);
        if (Boolean.FALSE.equals(presente)) {
            actividadInmutable.set(false);
            log.error("ESQUEMA_PENDIENTE: the actividad table has no immutability trigger. Run "
                    + "scripts/sql/V004__actividad_inmutable.sql (make migrate); until then the activity log is "
                    + "immutable only at the application level.");
        } else {
            actividadInmutable.set(true);
        }
    }

    /** False when V004 has not been applied. Informational; PostgreSQL only. */
    public boolean actividadInmutable() {
        return actividadInmutable.get();
    }

    private void verificarVersiones() {
        java.util.List<String> pendientes = jdbcTemplate.queryForList(CHECK_VERSIONES_PENDIENTES_SQL, String.class);
        if (pendientes != null && !pendientes.isEmpty()) {
            versionesInicializadas.set(false);
            log.error("ESQUEMA_PENDIENTE: rows with a NULL optimistic-lock version in {}. Run "
                    + "scripts/sql/V003__optimistic_version_columns.sql (make migrate); until then updates to "
                    + "those rows fail with CONFLICTO_CONCURRENTE.", pendientes);
        } else {
            versionesInicializadas.set(true);
        }
    }

    private void verificarOrigenOrganizacion() {
        java.util.List<String> pendientes =
                jdbcTemplate.queryForList(CHECK_ORIGEN_CHECKS_PENDIENTES_SQL, String.class);
        if (pendientes != null && !pendientes.isEmpty()) {
            origenOrganizacionMigrado.set(false);
            log.error("ESQUEMA_PENDIENTE: CHECK constraints {} reject the SIN_RECLAMAR / IMPORTADA_RENACOM "
                    + "values. Run scripts/sql/V007__organizacion_origen.sql (make migrate) before importing "
                    + "ReNaCoM organizaciones.", pendientes);
        } else {
            origenOrganizacionMigrado.set(true);
        }
    }

    /** False when V007 has not widened the organizaciones/evento CHECKs. Informational; PostgreSQL only. */
    public boolean origenOrganizacionMigrado() {
        return origenOrganizacionMigrado.get();
    }

    /** False when V003 has not been applied (NULL version rows exist). Informational; PostgreSQL only. */
    public boolean versionesInicializadas() {
        return versionesInicializadas.get();
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
