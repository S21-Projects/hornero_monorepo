package org.example.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * AD-13's runtime guard: at boot, on PostgreSQL only, checks whether
 * `scripts/sql/V001__donaciones_necesidad_id_nullable.sql` has already run against
 * `donaciones.necesidad_id`. If not, {@code DonacionService.crear(FONDO_COMUN)} must answer 503
 * `ESQUEMA_PENDIENTE` instead of a raw constraint-violation 500 — `DIRECTA` keeps working either
 * way. The check is skipped entirely on H2 (every other MS test suite runs against H2, never
 * PostgreSQL), verified here via a mocked database product name rather than a real H2 connection.
 */
@ExtendWith(MockitoExtension.class)
class EsquemaVerificadorTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private DataSource dataSource;

    @Mock
    private Connection connection;

    @Mock
    private DatabaseMetaData metaData;

    @InjectMocks
    private EsquemaVerificador esquemaVerificador;

    private void mockDatabaseProduct(String productName) throws Exception {
        when(jdbcTemplate.getDataSource()).thenReturn(dataSource);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.getMetaData()).thenReturn(metaData);
        when(metaData.getDatabaseProductName()).thenReturn(productName);
    }

    @Test
    void defaultState_beforeAnyBootCheck_treatsNecesidadIdAsNullable() {
        // Guards against a false-positive 503 if `crear` is ever called before the ApplicationRunner
        // has run (should not normally happen, but the default must be permissive, not fail-closed —
        // AD-13 explicitly rejects fail-fast-at-boot).
        assertThat(esquemaVerificador.necesidadIdEsNullable()).isTrue();
    }

    @Test
    void postgres_columnStillNotNull_flagsEsquemaPendiente() throws Exception {
        mockDatabaseProduct("PostgreSQL");
        when(jdbcTemplate.queryForObject(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn("NO");

        esquemaVerificador.run(new DefaultApplicationArguments());

        assertThat(esquemaVerificador.necesidadIdEsNullable()).isFalse();
    }

    @Test
    void postgres_columnAlreadyNullable_flagStaysTrue() throws Exception {
        mockDatabaseProduct("PostgreSQL");
        when(jdbcTemplate.queryForObject(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn("YES");

        esquemaVerificador.run(new DefaultApplicationArguments());

        assertThat(esquemaVerificador.necesidadIdEsNullable()).isTrue();
    }

    @Test
    void h2_neverQueriesInformationSchema_checkIsSkipped() throws Exception {
        mockDatabaseProduct("H2");

        esquemaVerificador.run(new DefaultApplicationArguments());

        assertThat(esquemaVerificador.necesidadIdEsNullable()).isTrue();
        org.mockito.Mockito.verify(jdbcTemplate, org.mockito.Mockito.never())
                .queryForObject(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(String.class));
    }

    @Test
    void postgres_rowsWithNullVersion_flagsV003Pending() throws Exception {
        mockDatabaseProduct("PostgreSQL");
        when(jdbcTemplate.queryForObject(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn("YES");
        when(jdbcTemplate.queryForList(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn(java.util.List.of("donaciones"));

        esquemaVerificador.run(new DefaultApplicationArguments());

        assertThat(esquemaVerificador.versionesInicializadas()).isFalse();
    }

    @Test
    void postgres_noNullVersions_v003NotPending() throws Exception {
        mockDatabaseProduct("PostgreSQL");
        when(jdbcTemplate.queryForObject(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn("YES");
        when(jdbcTemplate.queryForList(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn(java.util.List.of());

        esquemaVerificador.run(new DefaultApplicationArguments());

        assertThat(esquemaVerificador.versionesInicializadas()).isTrue();
    }

    @Test
    void defaultState_versionsAssumedInitialized() {
        assertThat(esquemaVerificador.versionesInicializadas()).isTrue();
    }

    @Test
    void postgres_actividadTriggerMissing_flagsV004Pending() throws Exception {
        mockDatabaseProduct("PostgreSQL");
        when(jdbcTemplate.queryForObject(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn("YES");
        when(jdbcTemplate.queryForObject(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(Boolean.class)))
                .thenReturn(false);

        esquemaVerificador.run(new DefaultApplicationArguments());

        assertThat(esquemaVerificador.actividadInmutable()).isFalse();
    }

    @Test
    void postgres_actividadTriggerPresent_v004NotPending() throws Exception {
        mockDatabaseProduct("PostgreSQL");
        when(jdbcTemplate.queryForObject(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn("YES");
        when(jdbcTemplate.queryForObject(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(Boolean.class)))
                .thenReturn(true);

        esquemaVerificador.run(new DefaultApplicationArguments());

        assertThat(esquemaVerificador.actividadInmutable()).isTrue();
    }

    @Test
    void defaultState_actividadAssumedImmutable() {
        assertThat(esquemaVerificador.actividadInmutable()).isTrue();
    }

    @Test
    void postgres_rowsWithNullEstadoDesde_flagsV005Pending() throws Exception {
        mockDatabaseProduct("PostgreSQL");
        when(jdbcTemplate.queryForObject(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn("YES");
        // 1st Boolean query = actividad trigger present, 2nd = rows with NULL estado_desde exist
        when(jdbcTemplate.queryForObject(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(Boolean.class)))
                .thenReturn(true, true);

        esquemaVerificador.run(new DefaultApplicationArguments());

        assertThat(esquemaVerificador.estadoDesdeCompleto()).isFalse();
    }

    @Test
    void postgres_noNullEstadoDesde_v005NotPending() throws Exception {
        mockDatabaseProduct("PostgreSQL");
        when(jdbcTemplate.queryForObject(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn("YES");
        when(jdbcTemplate.queryForObject(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(Boolean.class)))
                .thenReturn(true, false);

        esquemaVerificador.run(new DefaultApplicationArguments());

        assertThat(esquemaVerificador.estadoDesdeCompleto()).isTrue();
    }

    @Test
    void defaultState_estadoDesdeAssumedComplete() {
        assertThat(esquemaVerificador.estadoDesdeCompleto()).isTrue();
    }
}
