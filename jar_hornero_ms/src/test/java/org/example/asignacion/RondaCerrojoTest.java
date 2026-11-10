package org.example.asignacion;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RN-08: one ronda at a time across MS instances. On PostgreSQL the exclusion is a session-level
 * advisory lock held on one dedicated connection for the whole ronda (read, worker call, write);
 * anywhere else (H2 in tests) it degrades to the in-process lock only.
 */
class RondaCerrojoTest {

    private DataSource dataSource;
    private Connection connection;
    private PreparedStatement tryLock;
    private PreparedStatement unlock;
    private ResultSet tryLockResult;
    private ResultSet unlockResult;

    @BeforeEach
    void setUp() throws Exception {
        dataSource = mock(DataSource.class);
        connection = mock(Connection.class);
        tryLock = mock(PreparedStatement.class);
        unlock = mock(PreparedStatement.class);
        tryLockResult = mock(ResultSet.class);
        unlockResult = mock(ResultSet.class);
        DatabaseMetaData metaData = mock(DatabaseMetaData.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.getMetaData()).thenReturn(metaData);
        when(metaData.getDatabaseProductName()).thenReturn("PostgreSQL");
        when(connection.prepareStatement(contains("pg_try_advisory_lock"))).thenReturn(tryLock);
        when(connection.prepareStatement(contains("pg_advisory_unlock"))).thenReturn(unlock);
        when(tryLock.executeQuery()).thenReturn(tryLockResult);
        when(unlock.executeQuery()).thenReturn(unlockResult);
        when(tryLockResult.next()).thenReturn(true);
        when(unlockResult.next()).thenReturn(true);
        when(unlockResult.getBoolean(1)).thenReturn(true);
    }

    @Test
    void postgres_acquired_keepsTheDedicatedConnectionOpenUntilClosed() throws Exception {
        when(tryLockResult.getBoolean(1)).thenReturn(true);
        RondaCerrojo cerrojo = new RondaCerrojo(dataSource);

        Optional<RondaCerrojo.Candado> candado = cerrojo.intentar();

        assertThat(candado).isPresent();
        verify(tryLock).setLong(1, RondaCerrojo.CLAVE_ADVISORY);
        verify(connection, never()).close();

        candado.get().close();

        verify(unlock).setLong(1, RondaCerrojo.CLAVE_ADVISORY);
        verify(connection).close();
    }

    @Test
    void postgres_heldByAnotherInstance_returnsEmptyAndReleasesEverything() throws Exception {
        when(tryLockResult.getBoolean(1)).thenReturn(false);
        RondaCerrojo cerrojo = new RondaCerrojo(dataSource);

        assertThat(cerrojo.intentar()).isEmpty();

        verify(connection).close();
        verify(connection, never()).prepareStatement(contains("pg_advisory_unlock"));
        // The in-process lock was given back too, so a later attempt reaches the database again.
        assertThat(cerrojo.intentar()).isEmpty();
        verify(dataSource, times(2)).getConnection();
    }

    @Test
    void postgres_heldInThisProcess_isRejectedWithoutTouchingTheDatabase() throws Exception {
        when(tryLockResult.getBoolean(1)).thenReturn(true);
        RondaCerrojo cerrojo = new RondaCerrojo(dataSource);
        RondaCerrojo.Candado primero = cerrojo.intentar().orElseThrow();

        assertThat(cerrojo.intentar()).isEmpty();
        verify(dataSource, times(1)).getConnection();

        primero.close();
        assertThat(cerrojo.intentar()).isPresent();
    }

    @Test
    void postgres_unlockFailure_abortsTheConnectionSoThePoolNeverReusesTheSession() throws Exception {
        when(tryLockResult.getBoolean(1)).thenReturn(true);
        when(unlock.executeQuery()).thenThrow(new SQLException("connection reset"));
        RondaCerrojo cerrojo = new RondaCerrojo(dataSource);
        RondaCerrojo.Candado candado = cerrojo.intentar().orElseThrow();

        candado.close();

        verify(connection).abort(any());
        verify(connection).close();
        assertThat(cerrojo.intentar()).isPresent();
    }

    @Test
    void postgres_databaseFailureWhileAcquiring_failsLoudlyAndLeavesNothingLocked() throws Exception {
        when(tryLock.executeQuery()).thenThrow(new SQLException("down"));
        RondaCerrojo cerrojo = new RondaCerrojo(dataSource);

        assertThatThrownBy(cerrojo::intentar).isInstanceOf(IllegalStateException.class);

        verify(connection).close();
        org.mockito.Mockito.doReturn(tryLockResult).when(tryLock).executeQuery();
        when(tryLockResult.getBoolean(1)).thenReturn(true);
        assertThat(cerrojo.intentar()).isPresent();
    }

    @Test
    void nonPostgres_fallsBackToTheInProcessLockOnly() throws Exception {
        DatabaseMetaData h2 = mock(DatabaseMetaData.class);
        when(connection.getMetaData()).thenReturn(h2);
        when(h2.getDatabaseProductName()).thenReturn("H2");
        RondaCerrojo cerrojo = new RondaCerrojo(dataSource);

        RondaCerrojo.Candado primero = cerrojo.intentar().orElseThrow();
        assertThat(cerrojo.intentar()).isEmpty();
        primero.close();

        assertThat(cerrojo.intentar()).isPresent();
        verify(connection, never()).prepareStatement(contains("advisory"));
    }

    @Test
    void inProcessOnly_rejectsASecondAttemptFromAnotherThread() throws Exception {
        RondaCerrojo cerrojo = RondaCerrojo.soloEstaInstancia();
        RondaCerrojo.Candado primero = cerrojo.intentar().orElseThrow();
        AtomicReference<Optional<RondaCerrojo.Candado>> otro = new AtomicReference<>();

        Thread t = new Thread(() -> otro.set(cerrojo.intentar()));
        t.start();
        t.join();

        assertThat(otro.get()).isEmpty();
        primero.close();
    }

    @Test
    void closeIsIdempotent() throws Exception {
        when(tryLockResult.getBoolean(1)).thenReturn(true);
        RondaCerrojo.Candado candado = new RondaCerrojo(dataSource).intentar().orElseThrow();

        candado.close();
        candado.close();

        verify(connection, times(1)).close();
        verify(unlock, times(1)).executeQuery();
    }
}
