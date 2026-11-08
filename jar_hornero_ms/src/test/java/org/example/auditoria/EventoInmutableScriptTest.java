package org.example.auditoria;

import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrganizacionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.example.auditoria.CadenaTestSupport.evento;
import static org.example.auditoria.CadenaTestSupport.organizacion;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * V014 on a real PostgreSQL (skipped on H2; command in {@code RondaConcurrenciaIntegrationTest}).
 * It documents what the script does and does not protect, including under the ownership model the
 * application really has: ddl-auto=update makes the application role the OWNER of the table, and the
 * compose file makes it a SUPERUSER.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class EventoInmutableScriptTest {

    private static final Path V014 = Path.of("..", "scripts", "sql", "V014__organizacion_evento_inmutable.sql");

    @Autowired private DataSource dataSource;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private OrganizacionRepository organizacionRepository;
    @Autowired private OrganizacionEventoRepository eventoRepository;
    @Autowired private VerificadorCadena verificador;

    private boolean postgres;

    @BeforeEach
    void soloPostgres() throws SQLException {
        try (Connection c = dataSource.getConnection()) {
            postgres = "PostgreSQL".equalsIgnoreCase(c.getMetaData().getDatabaseProductName());
        }
        assumeTrue(postgres, "needs a real PostgreSQL; see RondaConcurrenciaIntegrationTest for the command");
    }

    @AfterEach
    void desinstalar() {
        if (!postgres) {
            return;
        }
        // Leave the shared test database as it was found; the table itself is dropped by create-drop.
        jdbc.execute("DROP TRIGGER IF EXISTS organizacion_evento_inmutable ON organizacion_evento");
        jdbc.execute("DROP TRIGGER IF EXISTS organizacion_evento_inmutable_truncate ON organizacion_evento");
        jdbc.execute("GRANT ALL ON organizacion_evento TO PUBLIC");
    }

    private void ejecutarScript() throws Exception {
        try (Connection c = dataSource.getConnection(); Statement st = c.createStatement()) {
            st.execute(Files.readString(V014));
        }
    }

    private long unEvento() {
        Organizacion org = organizacion(organizacionRepository, "Inmutable");
        evento(eventoRepository, org, "original");
        return jdbc.queryForObject("select max(id) from organizacion_evento where organizacion_id = ?", Long.class, org.getId());
    }

    @Test
    void afterTheScriptEditingOrDeletingAnEventIsRejected_evenForASuperuser() throws Exception {
        ejecutarScript();
        long id = unEvento();

        assertThatThrownBy(() -> jdbc.update("update organizacion_evento set motivo = 'x' where id = ?", id))
                .hasMessageContaining("inmutable");
        assertThatThrownBy(() -> jdbc.update("delete from organizacion_evento where id = ?", id))
                .hasMessageContaining("inmutable");
        assertThatThrownBy(() -> jdbc.execute("truncate organizacion_evento")).hasMessageContaining("inmutable");
        assertThat(jdbc.queryForObject("select motivo from organizacion_evento where id = ?", String.class, id))
                .isEqualTo("original");
    }

    @Test
    void insertsStillWorkAndTheScriptIsIdempotent() throws Exception {
        ejecutarScript();
        ejecutarScript();
        unEvento();
        assertThat(verificador.verificar().integra()).isTrue();
    }

    @Test
    void theChainBackfillStillWorksAfterTheProtectionIsApplied_andOnlyForUnsealedRows() throws Exception {
        Organizacion org = organizacion(organizacionRepository, "Inmutable backfill");
        CadenaTestSupport.insertarSinHash(jdbc, org.getId(), "heredado 1");
        CadenaTestSupport.insertarSinHash(jdbc, org.getId(), "heredado 2");
        ejecutarScript();
        // A legacy row can also appear after the script (a restore of an older dump).
        CadenaTestSupport.insertarSinHash(jdbc, org.getId(), "heredado 3");

        int sellados = verificador.cadena().completarPendientes();

        assertThat(sellados).isGreaterThanOrEqualTo(3);
        assertThat(verificador.verificar().integra()).isTrue();
        List<Long> ids = CadenaTestSupport.ids(jdbc, org.getId());
        // Once sealed, a row cannot be touched again, not even to "re-seal" it.
        assertThatThrownBy(() -> jdbc.update("update organizacion_evento set hash = ?, prev_hash = ? where id = ?",
                "f".repeat(64), "e".repeat(64), ids.get(0))).hasMessageContaining("inmutable");
    }

    @Test
    void theSealingExceptionDoesNotAllowChangingAnyOtherColumn() throws Exception {
        Organizacion org = organizacion(organizacionRepository, "Inmutable sello");
        long id = CadenaTestSupport.insertarSinHash(jdbc, org.getId(), "heredado");
        ejecutarScript();

        assertThatThrownBy(() -> jdbc.update(
                "update organizacion_evento set hash = ?, prev_hash = ?, motivo = 'otro' where id = ?",
                "a".repeat(64), CadenaHash.GENESIS, id)).hasMessageContaining("inmutable");
        assertThatThrownBy(() -> jdbc.update("update organizacion_evento set motivo = 'otro' where id = ?", id))
                .hasMessageContaining("inmutable");
    }

    /**
     * The honest part: under ddl-auto=update the application role OWNS the table. REVOKE does stop a
     * non-superuser owner, but the owner can grant itself the privilege back, and a superuser (the
     * compose default) is not subject to privileges at all. Only the trigger holds in both cases.
     */
    @Test
    void revokeBindsANonSuperuserOwnerOnlyUntilItGrantsItselfTheRightBack_andTheTriggerStillHolds() throws Exception {
        long id = unEvento();
        try (Connection c = dataSource.getConnection(); Statement st = c.createStatement()) {
            st.execute("DROP FUNCTION IF EXISTS organizacion_evento_inmutable() CASCADE"); // owned by the superuser
            st.execute("DROP ROLE IF EXISTS c4_owner_test");
            st.execute("CREATE ROLE c4_owner_test LOGIN NOSUPERUSER");
            st.execute("ALTER TABLE organizacion_evento OWNER TO c4_owner_test");
            st.execute("GRANT CREATE ON SCHEMA public TO c4_owner_test"); // PostgreSQL 15+: not implied
            try {
                st.execute("SET ROLE c4_owner_test");
                st.execute(Files.readString(V014));

                assertThatSql(st, "update organizacion_evento set motivo = 'x' where id = " + id, "permission denied");
                assertThatSql(st, "delete from organizacion_evento where id = " + id, "permission denied");

                // The owner re-grants itself the right: the REVOKE alone is not a barrier.
                st.execute("GRANT UPDATE, DELETE ON organizacion_evento TO c4_owner_test");
                assertThatSql(st, "update organizacion_evento set motivo = 'x' where id = " + id, "inmutable");
                assertThatSql(st, "delete from organizacion_evento where id = " + id, "inmutable");

                // ...and so can the owner remove the trigger: this is the documented limit.
                st.execute("DROP TRIGGER organizacion_evento_inmutable ON organizacion_evento");
                assertThat(st.executeUpdate("update organizacion_evento set motivo = 'reescrito' where id = " + id)).isEqualTo(1);
            } finally {
                try {
                    st.execute("ROLLBACK");
                } catch (SQLException ignorada) {
                    // no transaction was open
                }
                st.execute("RESET ROLE");
                st.execute("ALTER TABLE organizacion_evento OWNER TO " + usuarioActual(st));
                st.execute("DROP FUNCTION IF EXISTS organizacion_evento_inmutable() CASCADE");
                st.execute("DROP OWNED BY c4_owner_test");
                // Undo the deliberate rewrite so later tests on the shared database still see an intact chain.
                st.execute("UPDATE organizacion_evento SET motivo = 'original' WHERE id = " + id);
                st.execute("DROP ROLE c4_owner_test");
            }
        }
    }

    private static String usuarioActual(Statement st) throws SQLException {
        try (var rs = st.executeQuery("select current_user")) {
            rs.next();
            return "\"" + rs.getString(1) + "\"";
        }
    }

    private static void assertThatSql(Statement st, String sql, String mensaje) {
        assertThatThrownBy(() -> st.execute(sql)).hasMessageContaining(mensaje);
    }
}
