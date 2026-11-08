package org.example.asignacion;

import org.example.actividad.ActividadService;
import org.example.asignacion.worker.AsignadorClient;
import org.example.asignacion.worker.dto.AsignacionSalidaV1;
import org.example.asignacion.worker.dto.EntradaRondaV1;
import org.example.asignacion.worker.dto.SalidaRondaV1;
import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.example.domain.Asignacion;
import org.example.domain.AsignacionRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoAsignacion;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.ModalidadDonacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadArticulo;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.example.domain.Ronda;
import org.example.domain.RondaRepository;
import org.example.domain.UnidadArticulo;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.server.ResponseStatusException;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * RN-08, no double reassignment, with real repositories and real transactions.
 *
 * <p>The tests that do not say otherwise run on H2 (the project's test database), so they prove the
 * application logic (ronda lock, row lock plus state re-check) and not PostgreSQL behaviour. The
 * three {@code postgres_*} tests need a real PostgreSQL and skip themselves on H2. To run them:
 * start any scratch PostgreSQL, then
 * {@code SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/test SPRING_DATASOURCE_USERNAME=...
 * SPRING_DATASOURCE_PASSWORD=... SPRING_DATASOURCE_DRIVER_CLASS_NAME=org.postgresql.Driver
 * SPRING_JPA_PROPERTIES_HIBERNATE_DIALECT=org.hibernate.dialect.PostgreSQLDialect
 * mvn test -Dtest=RondaConcurrenciaIntegrationTest}. Never point them at a database with real data:
 * the context recreates the schema.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class RondaConcurrenciaIntegrationTest {

    private static final Path V013 = Path.of("..", "scripts", "sql", "V013__asignaciones_una_activa_por_donacion.sql");

    @Autowired private RondaService rondaService;
    @Autowired private OrganizacionRepository organizacionRepository;
    @Autowired private NecesidadRepository necesidadRepository;
    @Autowired private DonacionRepository donacionRepository;
    @Autowired private AsignacionRepository asignacionRepository;
    @Autowired private RondaRepository rondaRepository;
    @Autowired private ArticuloRepository articuloRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private DataSource dataSource;
    @Autowired private EntradaRondaFactory entradaRondaFactory;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private ActividadService actividadService;
    @Autowired private ApplicationEventPublisher eventPublisher;
    @Autowired private Clock clock;

    @MockBean private AsignadorClient asignadorClient;

    private record Escenario(Long donacionId, Long necesidadId, Long organizacionId) {
    }

    private Escenario escenario() {
        String s = UUID.randomUUID().toString().substring(0, 8);
        Articulo arroz = new Articulo();
        arroz.setNombre("Arroz concurrente " + s);
        arroz.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        arroz.setUnidad(UnidadArticulo.KG);
        arroz.setActivo(true);
        arroz = articuloRepository.save(arroz);

        Referente referente = (Referente) usuarioRepository.save(
                new Referente(null, "Ref " + s, "ref-conc-" + s + "@test.com", "hash", true));
        Organizacion org = new Organizacion();
        org.setNombre("Comedor concurrente " + s);
        org.setValidada(true);
        org.setNivel(NivelAcreditacion.N1);
        org.setReferente(referente);
        org.setLatitud(-31.40);
        org.setLongitud(-64.20);
        org = organizacionRepository.save(org);

        Necesidad necesidad = new Necesidad();
        necesidad.setOrganizacion(org);
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setPrioridad(PrioridadNecesidad.MEDIA);
        necesidad.setFechaPublicacion(LocalDate.now().minusDays(3));
        NecesidadArticulo na = new NecesidadArticulo();
        na.setArticulo(arroz);
        na.setNecesidad(necesidad);
        necesidad.getArticulos().add(na);
        necesidad = necesidadRepository.save(necesidad);

        Donante donante = (Donante) usuarioRepository.save(
                new Donante(null, "Donante " + s, "don-conc-" + s + "@test.com", "hash", true));
        Donacion donacion = new Donacion();
        donacion.setDonante(donante);
        donacion.setEstado(EstadoDonacion.OFRECIDA);
        donacion.setModalidad(ModalidadDonacion.FONDO_COMUN);
        donacion.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        donacion.setLatitud(-31.41);
        donacion.setLongitud(-64.18);
        donacion.setFechaOferta(LocalDate.now().minusDays(1));
        var linea = new org.example.domain.DonacionLinea();
        linea.setArticulo(arroz);
        linea.setCantidad(BigDecimal.TEN);
        linea.setDonacion(donacion);
        donacion.getLineas().add(linea);
        donacion = donacionRepository.save(donacion);
        return new Escenario(donacion.getId(), necesidad.getId(), org.getId());
    }

    /** The worker's answer: this donation goes to this necesidad. */
    private SalidaRondaV1 salidaCon(Escenario e) {
        AsignacionSalidaV1 a = new AsignacionSalidaV1();
        a.setDonacionId(e.donacionId());
        a.setNecesidadId(e.necesidadId());
        a.setOrganizacionId(e.organizacionId());
        a.setScore(0.5);
        SalidaRondaV1 salida = new SalidaRondaV1();
        salida.setVersion(1);
        salida.setAsignaciones(List.of(a));
        salida.setSinAsignar(List.of());
        salida.setScoreTotal(0.5);
        return salida;
    }

    private List<Asignacion> asignacionesDe(Long donacionId) {
        return asignacionRepository.findByDonacion_IdOrderByCreadaEnDesc(donacionId);
    }

    /**
     * Two rondas started at the same time on one instance: the second finds the lock taken and
     * answers 409 RONDA_EN_CURSO without reading anything; the first one assigns the donation once.
     */
    @Test
    void twoParallelRondas_secondAnswers409_donationAssignedOnce() throws Exception {
        Escenario e = escenario();
        CountDownLatch workerEntered = new CountDownLatch(1);
        CountDownLatch releaseWorker = new CountDownLatch(1);
        when(asignadorClient.ejecutar(any(EntradaRondaV1.class))).thenAnswer(inv -> {
            workerEntered.countDown();
            releaseWorker.await(10, TimeUnit.SECONDS);
            return salidaCon(e);
        });

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Ronda> primera = pool.submit(() -> rondaService.ejecutar(99L));
            assertThat(workerEntered.await(10, TimeUnit.SECONDS)).isTrue();

            Future<Ronda> segunda = pool.submit(() -> rondaService.ejecutar(98L));
            assertThatThrownBy(() -> resultado(segunda))
                    .isInstanceOf(ResponseStatusException.class)
                    .hasMessageContaining("RONDA_EN_CURSO");

            releaseWorker.countDown();
            assertThat(primera.get(10, TimeUnit.SECONDS).getAsignadas()).isEqualTo(1);
        } finally {
            releaseWorker.countDown();
            pool.shutdownNow();
        }

        assertThat(asignacionesDe(e.donacionId())).hasSize(1);
        assertThat(donacionRepository.findById(e.donacionId()).orElseThrow().getNecesidad().getId())
                .isEqualTo(e.necesidadId());
    }

    private static <T> T resultado(Future<T> f) throws Throwable {
        try {
            return f.get(10, TimeUnit.SECONDS);
        } catch (ExecutionException ex) {
            throw ex.getCause();
        }
    }

    /**
     * Defense in depth: a second MS instance has its own in-process lock, and on H2 there is no
     * advisory lock, so both rondas run at once. A barrier holds both workers until both have read
     * the pool, so each one will try to assign the same donation. The row lock plus the state
     * re-check must let exactly one win; the other discards the pair.
     */
    @Test
    void twoRondasThatBothReadTheSamePool_donationIsAssignedOnlyOnce() throws Exception {
        Escenario e = escenario();
        CyclicBarrier ambosLeyeronElFondo = new CyclicBarrier(2);
        when(asignadorClient.ejecutar(any(EntradaRondaV1.class))).thenAnswer(inv -> {
            ambosLeyeronElFondo.await(10, TimeUnit.SECONDS);
            return salidaCon(e);
        });
        RondaService otraInstancia = new RondaService(donacionRepository, necesidadRepository, asignacionRepository,
                rondaRepository, entradaRondaFactory, asignadorClient, usuarioRepository, clock, transactionManager,
                actividadService, eventPublisher, RondaCerrojo.soloEstaInstancia());

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Callable<Ronda> a = () -> rondaService.ejecutar(99L);
            Callable<Ronda> b = () -> otraInstancia.ejecutar(98L);
            Future<Ronda> fa = pool.submit(a);
            Future<Ronda> fb = pool.submit(b);
            Ronda ra = fa.get(30, TimeUnit.SECONDS);
            Ronda rb = fb.get(30, TimeUnit.SECONDS);

            assertThat(ra.getAsignadas() + rb.getAsignadas()).isEqualTo(1);
            assertThat(ra.getDescartadas() + rb.getDescartadas()).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }

        List<Asignacion> filas = asignacionesDe(e.donacionId());
        assertThat(filas).hasSize(1);
        assertThat(filas.get(0).getEstado()).isEqualTo(EstadoAsignacion.PROPUESTA);
    }

    // ----- PostgreSQL only -------------------------------------------------------------------

    private boolean esPostgres() throws SQLException {
        try (Connection c = dataSource.getConnection()) {
            return "PostgreSQL".equalsIgnoreCase(c.getMetaData().getDatabaseProductName());
        }
    }

    private void ejecutarScript(Path script) throws Exception {
        String sql = Files.readString(script);
        try (Connection c = dataSource.getConnection(); Statement st = c.createStatement()) {
            try {
                st.execute(sql);
            } catch (SQLException e) {
                // The script opens its own transaction; like psql ending the session, leave nothing
                // half-open on a pooled connection.
                st.execute("ROLLBACK");
                throw e;
            }
        }
    }

    private void sql(String sentencia) throws SQLException {
        try (Connection c = dataSource.getConnection(); Statement st = c.createStatement()) {
            st.execute(sentencia);
        }
    }

    private Asignacion propuesta(Ronda ronda, Escenario e, EstadoAsignacion estado) {
        Asignacion a = new Asignacion();
        a.setRonda(ronda);
        a.setDonacion(donacionRepository.getReferenceById(e.donacionId()));
        a.setNecesidad(necesidadRepository.getReferenceById(e.necesidadId()));
        a.setOrganizacion(organizacionRepository.getReferenceById(e.organizacionId()));
        a.setEstado(estado);
        a.setCreadaEn(Instant.now());
        return a;
    }

    private Ronda ronda() {
        Ronda r = new Ronda();
        r.setEjecutadaEn(Instant.now());
        r.setOrigen(org.example.domain.OrigenRonda.MANUAL);
        r.setEstado(org.example.domain.EstadoRonda.COMPLETADA);
        r.setVersionContrato(1);
        return rondaRepository.save(r);
    }

    @Test
    void postgres_v013RejectsASecondProposalForTheSameDonation() throws Exception {
        assumeTrue(esPostgres(), "needs a real PostgreSQL; see the class Javadoc");
        ejecutarScript(V013);
        ejecutarScript(V013); // idempotent
        Escenario e = escenario();
        Ronda r = ronda();
        asignacionRepository.saveAndFlush(propuesta(r, e, EstadoAsignacion.PROPUESTA));

        assertThatThrownBy(() -> asignacionRepository.saveAndFlush(propuesta(r, e, EstadoAsignacion.PROPUESTA)))
                .isInstanceOf(DataIntegrityViolationException.class);

        // A resolved one does not count, and neither does ACEPTADA (see the script header).
        asignacionRepository.saveAndFlush(propuesta(r, e, EstadoAsignacion.RECHAZADA));
        asignacionRepository.saveAndFlush(propuesta(r, e, EstadoAsignacion.ACEPTADA));
    }

    @Test
    void postgres_v013AbortsWithAClearMessageWhenDuplicatesAlreadyExist_andChangesNothing() throws Exception {
        assumeTrue(esPostgres(), "needs a real PostgreSQL; see the class Javadoc");
        sql("DROP INDEX IF EXISTS ux_asignacion_activa_por_donacion");
        Escenario e = escenario();
        Ronda r = ronda();
        asignacionRepository.saveAndFlush(propuesta(r, e, EstadoAsignacion.PROPUESTA));
        asignacionRepository.saveAndFlush(propuesta(r, e, EstadoAsignacion.PROPUESTA));
        long antes = asignacionesDe(e.donacionId()).size();

        assertThatThrownBy(() -> ejecutarScript(V013))
                .hasMessageContaining("V013 aborted")
                .hasMessageContaining(String.valueOf(e.donacionId()));

        assertThat(asignacionesDe(e.donacionId())).hasSize((int) antes);
        try (Connection c = dataSource.getConnection(); Statement st = c.createStatement();
             var rs = st.executeQuery("SELECT count(*) FROM pg_indexes WHERE indexname = 'ux_asignacion_activa_por_donacion'")) {
            rs.next();
            assertThat(rs.getInt(1)).isZero();
        }

        // Resolve by hand, as the message says, and the script now succeeds.
        sql("UPDATE asignaciones SET estado = 'CANCELADA' WHERE donacion_id = " + e.donacionId()
                + " AND id <> (SELECT min(id) FROM asignaciones WHERE donacion_id = " + e.donacionId() + ")");
        ejecutarScript(V013);
    }

    @Test
    void postgres_advisoryLockExcludesASecondInstance() throws Exception {
        assumeTrue(esPostgres(), "needs a real PostgreSQL; see the class Javadoc");
        RondaCerrojo instanciaA = new RondaCerrojo(dataSource);
        RondaCerrojo instanciaB = new RondaCerrojo(dataSource); // separate JVM-level state, same database

        List<RondaCerrojo.Candado> abiertos = new ArrayList<>();
        try {
            RondaCerrojo.Candado deA = instanciaA.intentar().orElseThrow();
            abiertos.add(deA);

            assertThat(instanciaB.intentar()).as("second instance while A holds the lock").isEmpty();

            deA.close();
            RondaCerrojo.Candado deB = instanciaB.intentar().orElseThrow();
            abiertos.add(deB);
            assertThat(instanciaA.intentar()).as("first instance while B holds the lock").isEmpty();
        } finally {
            abiertos.forEach(RondaCerrojo.Candado::close);
        }
        // Released by B's close: A can take it again (and must give it back, the pool is shared).
        RondaCerrojo.Candado otraVezDeA = instanciaA.intentar().orElseThrow();
        otraVezDeA.close();
    }
}
