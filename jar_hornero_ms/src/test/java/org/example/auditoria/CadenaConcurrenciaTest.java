package org.example.auditoria;

import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrganizacionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.TimeZone;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.example.auditoria.CadenaTestSupport.evento;
import static org.example.auditoria.CadenaTestSupport.organizacion;

/**
 * Real transactions, real threads. Runs on the project's H2 and, to prove the behaviour on the
 * production engine, on any PostgreSQL given through the SPRING_DATASOURCE_* variables (see
 * {@code RondaConcurrenciaIntegrationTest} for the exact command). It recreates the schema: never
 * point it at a database with real data.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class CadenaConcurrenciaTest {

    @Autowired private OrganizacionRepository organizacionRepository;
    @Autowired private OrganizacionEventoRepository eventoRepository;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private VerificadorCadena verificador;

    @Test
    void concurrentWritersOfTheSameOrganizationNeverForkTheChain() throws Exception {
        Organizacion org = organizacion(organizacionRepository, "Concurrencia");
        int hilos = 8;
        int porHilo = 10;
        correrEnParalelo(hilos, porHilo, List.of(org));

        List<String> prev = jdbc.queryForList(
                "select prev_hash from organizacion_evento where organizacion_id = ?", String.class, org.getId());
        assertThat(prev).hasSize(hilos * porHilo);
        assertThat(prev).as("no two events share a predecessor").doesNotHaveDuplicates();
        assertThat(verificador.verificar().integra()).isTrue();
    }

    @Test
    void concurrentWritersAcrossSeveralOrganizationsKeepEveryChainIntact() throws Exception {
        List<Organizacion> orgs = List.of(
                organizacion(organizacionRepository, "Concurrencia 1"),
                organizacion(organizacionRepository, "Concurrencia 2"),
                organizacion(organizacionRepository, "Concurrencia 3"));
        correrEnParalelo(6, 12, orgs);

        for (Organizacion o : orgs) {
            Integer n = jdbc.queryForObject(
                    "select count(*) from organizacion_evento where organizacion_id = ?", Integer.class, o.getId());
            assertThat(n).isEqualTo(24);
        }
        assertThat(verificador.verificar().integra()).isTrue();
    }

    @Test
    void theUniqueIndexRejectsAForkEvenWithoutTheRowLock() {
        Organizacion org = organizacion(organizacionRepository, "Bifurcacion");
        evento(eventoRepository, org, "primero");
        String cabeza = jdbc.queryForObject(
                "select hash from organizacion_evento where organizacion_id = ?", String.class, org.getId());

        String insertar = "insert into organizacion_evento (organizacion_id, tipo, ocurrido_en, actor_tipo, prev_hash, hash) "
                + "values (?, 'REFERENTE_REASIGNADO', ?, 'SISTEMA', ?, ?)";
        jdbc.update(insertar, org.getId(), OffsetDateTime.now(), cabeza, "a".repeat(64));

        assertThatThrownBy(() -> jdbc.update(insertar, org.getId(), OffsetDateTime.now(), cabeza, "b".repeat(64)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void theHashRoundTripsThroughTheDatabaseWhateverTheJvmTimeZone() {
        TimeZone original = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("America/Argentina/Buenos_Aires"));
            Organizacion org = organizacion(organizacionRepository, "Zona horaria");
            evento(eventoRepository, org, "uno");
            TimeZone.setDefault(TimeZone.getTimeZone("Pacific/Auckland"));
            evento(eventoRepository, org, "dos");
            // A legacy row with an explicit offset and microsecond precision, sealed by the backfill.
            jdbc.update("insert into organizacion_evento (organizacion_id, tipo, ocurrido_en, actor_tipo, motivo) "
                            + "values (?, 'REFERENTE_REASIGNADO', ?, 'SISTEMA', ?)",
                    org.getId(), OffsetDateTime.parse("2026-03-08T07:30:00.123457-03:00"), "heredado");
            TimeZone.setDefault(TimeZone.getTimeZone("UTC"));

            evento(eventoRepository, org, "tres");

            assertThat(verificador.verificar().integra()).isTrue();
        } finally {
            TimeZone.setDefault(original);
        }
    }

    private void correrEnParalelo(int hilos, int porHilo, List<Organizacion> orgs) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(hilos);
        CyclicBarrier salida = new CyclicBarrier(hilos);
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        List<Future<?>> trabajos = new ArrayList<>();
        try {
            for (int h = 0; h < hilos; h++) {
                final int hilo = h;
                trabajos.add(pool.submit(() -> {
                    salida.await(30, TimeUnit.SECONDS);
                    for (int i = 0; i < porHilo; i++) {
                        Organizacion o = orgs.get((hilo + i) % orgs.size());
                        final int n = i;
                        tx.executeWithoutResult(s -> evento(eventoRepository, o, "hilo " + hilo + " evento " + n));
                    }
                    return null;
                }));
            }
            for (Future<?> f : trabajos) {
                f.get(120, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }
    }
}
