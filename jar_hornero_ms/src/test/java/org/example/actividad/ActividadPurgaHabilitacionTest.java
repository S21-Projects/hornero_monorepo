package org.example.actividad;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * M6: the DB trigger only lets rows be deleted while {@code hornero.purga_actividad} is 'on'. H2
 * (every MS test suite) has no such trigger, so the real enforcement is verified against Postgres
 * (see docs/db-changes.md); here we pin that the job sets the setting inside its own transaction,
 * before the delete, and only on PostgreSQL.
 */
@ExtendWith(MockitoExtension.class)
class ActividadPurgaHabilitacionTest {

    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private DataSource dataSource;
    @Mock private Connection connection;
    @Mock private DatabaseMetaData metaData;
    @Mock private ActividadRetencionRepository repository;
    @Mock private ActividadService actividadService;

    private void producto(String nombre) throws Exception {
        when(jdbcTemplate.getDataSource()).thenReturn(dataSource);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.getMetaData()).thenReturn(metaData);
        when(metaData.getDatabaseProductName()).thenReturn(nombre);
    }

    @Test
    void postgres_setsTheTransactionLocalSettingToOn() throws Exception {
        producto("PostgreSQL");

        new ActividadPurgaHabilitacion(jdbcTemplate).habilitar();

        verify(jdbcTemplate).queryForObject(
                eq("SELECT set_config('hornero.purga_actividad', 'on', true)"), eq(String.class));
    }

    @Test
    void h2_isANoOp() throws Exception {
        producto("H2");

        new ActividadPurgaHabilitacion(jdbcTemplate).habilitar();

        verify(jdbcTemplate, never()).queryForObject(anyString(), eq(String.class));
    }

    @Test
    void job_enablesThePurgeBeforeDeleting() {
        ActividadPurgaHabilitacion habilitacion = org.mockito.Mockito.mock(ActividadPurgaHabilitacion.class);
        Clock clock = Clock.fixed(Instant.parse("2026-10-12T12:00:00Z"), ZoneOffset.UTC);
        when(repository.purgarAnterioresA(any())).thenReturn(0);

        new ActividadRetencionJob(repository, actividadService, clock, habilitacion, 365).purgar();

        InOrder orden = inOrder(habilitacion, repository);
        orden.verify(habilitacion).habilitar();
        orden.verify(repository).purgarAnterioresA(any());
    }
}
