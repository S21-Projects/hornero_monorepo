package org.example.asignacion;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.concurrent.Semaphore;

/**
 * RN-08: at most one ronda at a time, across MS instances, for the manual trigger, the scheduled
 * one and any future caller (they all go through {@code RondaService.ejecutar}).
 *
 * <p>A ronda is read transaction, then an HTTP call to the worker (up to its 30 s read timeout),
 * then a write transaction. A transaction-scoped lock ({@code pg_advisory_xact_lock}) would only
 * cover one of those phases, or would force a transaction (a pooled connection, an open snapshot,
 * "idle in transaction") to stay open across the worker call. So the lock is a session-level
 * advisory lock ({@code pg_try_advisory_lock}) held on one dedicated pooled connection for the
 * whole ronda, outside any transaction: no row locks, no snapshot, one connection out of the pool.
 * PostgreSQL releases it by itself if the connection or the process dies, so a crash never leaves
 * a stuck "ronda en curso" row to clean up.
 *
 * <p>An in-process permit is taken first: it rejects a second ronda in the same JVM
 * without a database round trip, and it is the only exclusion where the database is not
 * PostgreSQL (the H2 test suites). Limitation: the advisory lock is per database session, so it
 * would not survive a transaction-pooling proxy such as PgBouncer in transaction mode; the stack
 * connects straight to PostgreSQL.
 */
@Slf4j
@Component
public class RondaCerrojo {

    /** Arbitrary constant identifying "the ronda lock" in {@code pg_locks}; ASCII "HORNERO1". */
    static final long CLAVE_ADVISORY = 0x484F524E45524F31L;

    private static final String POSTGRES = "PostgreSQL";

    private final DataSource dataSource;
    /** Not reentrant on purpose: a second attempt must fail even from the thread holding it. */
    private final Semaphore jvm = new Semaphore(1);
    /** null until the first attempt looks at the database product. */
    private volatile Boolean postgres;

    @Autowired
    public RondaCerrojo(DataSource dataSource) {
        this.dataSource = dataSource;
        this.postgres = null;
    }

    private RondaCerrojo() {
        this.dataSource = null;
        this.postgres = Boolean.FALSE;
    }

    /** In-process exclusion only, for tests and tools that have no database. */
    public static RondaCerrojo soloEstaInstancia() {
        return new RondaCerrojo();
    }

    /** Takes the lock without waiting; empty when another ronda holds it (here or elsewhere). */
    public Optional<Candado> intentar() {
        if (!jvm.tryAcquire()) {
            return Optional.empty();
        }
        Connection conexion = null;
        try {
            if (Boolean.FALSE.equals(postgres)) {
                return Optional.of(new Candado(null));
            }
            conexion = dataSource.getConnection();
            if (postgres == null) {
                postgres = POSTGRES.equalsIgnoreCase(conexion.getMetaData().getDatabaseProductName());
            }
            if (!postgres) {
                cerrarSilencioso(conexion);
                conexion = null;
                return Optional.of(new Candado(null));
            }
            try (PreparedStatement ps = conexion.prepareStatement("SELECT pg_try_advisory_lock(?)")) {
                ps.setLong(1, CLAVE_ADVISORY);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next() && rs.getBoolean(1)) {
                        Candado candado = new Candado(conexion);
                        conexion = null; // owned by the Candado now
                        return Optional.of(candado);
                    }
                }
            }
            jvm.release();
            return Optional.empty();
        } catch (SQLException | RuntimeException e) {
            jvm.release();
            throw new IllegalStateException("Could not take the ronda lock", e);
        } finally {
            if (conexion != null) {
                cerrarSilencioso(conexion);
            }
        }
    }

    private static void cerrarSilencioso(Connection conexion) {
        try {
            conexion.close();
        } catch (SQLException e) {
            log.warn("[rondas] could not close the lock connection: {}", e.getMessage());
        }
    }

    /** A held lock; close it exactly once when the ronda ends. */
    public final class Candado implements AutoCloseable {

        private Connection conexion;
        private boolean cerrado;

        private Candado(Connection conexion) {
            this.conexion = conexion;
        }

        @Override
        public void close() {
            if (cerrado) {
                return;
            }
            cerrado = true;
            try {
                if (conexion != null) {
                    liberarAdvisory();
                }
            } finally {
                jvm.release();
            }
        }

        private void liberarAdvisory() {
            boolean liberado = false;
            try (PreparedStatement ps = conexion.prepareStatement("SELECT pg_advisory_unlock(?)")) {
                ps.setLong(1, CLAVE_ADVISORY);
                try (ResultSet rs = ps.executeQuery()) {
                    liberado = rs.next() && rs.getBoolean(1);
                }
            } catch (SQLException e) {
                log.error("[rondas] could not release the ronda advisory lock: {}", e.getMessage());
            }
            if (!liberado) {
                // Never hand a session that may still hold the lock back to the pool: closing the
                // physical connection makes PostgreSQL drop it.
                try {
                    conexion.abort(Runnable::run);
                } catch (SQLException e) {
                    log.error("[rondas] could not abort the lock connection: {}", e.getMessage());
                }
            }
            cerrarSilencioso(conexion);
            conexion = null;
        }
    }
}
