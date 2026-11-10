package org.example.donacion.entrega;

import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.example.donacion.ParticipantesDonacion;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Task 3a.5: proves the {@code PESSIMISTIC_WRITE} row lock (`DonacionRepository.findByIdForUpdate`)
 * is load-bearing. Two real threads verify each other's code for the same donación at (as close
 * as JVM scheduling allows to) the same instant; without the lock each transaction would read
 * "the other party hasn't confirmed yet" and the donación would get stuck forever at
 * {@code PENDIENTE_CONFIRMACION} instead of reaching {@code ENTREGADA} exactly once.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class EntregaControllerIntegrationTest {

    @Autowired
    private EntregaService entregaService;

    @Autowired
    private DonacionRepository donacionRepository;

    @Autowired
    private NecesidadRepository necesidadRepository;

    @Autowired
    private OrganizacionRepository organizacionRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private CodigoEntregaRepository codigoEntregaRepository;

    @Autowired
    private org.springframework.transaction.PlatformTransactionManager transactionManager;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Test
    void concurrentMutualVerification_reachesEntregadaExactlyOnce() throws Exception {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);

        Long[] ids = tx.execute(status -> {
            Donante donante = usuarioRepository.save(
                    new Donante(null, "Donante Concurrencia", "donante-conc-" + System.nanoTime() + "@test.com", "x", true));
            Referente referente = usuarioRepository.save(
                    new Referente(null, "Referente Concurrencia", "referente-conc-" + System.nanoTime() + "@test.com", "x", true));

            Organizacion organizacion = new Organizacion();
            organizacion.setNombre("Comedor Concurrencia");
            organizacion.setSlug("comedor-concurrencia-" + System.nanoTime());
            organizacion.setEstado(EstadoOrganizacion.APROBADA);
            organizacion.setReferente(referente);
            organizacion = organizacionRepository.save(organizacion);

            Necesidad necesidad = new Necesidad();
            necesidad.setDescripcion("Arroz");
            necesidad.setPrioridad(PrioridadNecesidad.NORMAL);
            necesidad.setEstado(EstadoNecesidad.ABIERTA);
            necesidad.setOrganizacion(organizacion);
            necesidad = necesidadRepository.save(necesidad);

            Donacion donacion = new Donacion();
            donacion.setDonante(donante);
            donacion.setNecesidad(necesidad);
            donacion.setEstado(EstadoDonacion.EN_CAMINO);
            donacion = donacionRepository.save(donacion);

            Instant expiraEn = Instant.now().plus(10, ChronoUnit.MINUTES);

            CodigoEntrega delDonante = new CodigoEntrega();
            delDonante.setDonacion(donacion);
            delDonante.setEmisorId(donante.getId());
            delDonante.setEmisorParte(ParticipantesDonacion.Parte.DONANTE);
            delDonante.setCodigoHash(passwordEncoder.encode("111111"));
            delDonante.setExpiraEn(expiraEn);
            delDonante.setIntentos(0);
            delDonante.setUsado(false);
            delDonante.setCreadoEn(Instant.now());
            codigoEntregaRepository.save(delDonante);

            CodigoEntrega delReferente = new CodigoEntrega();
            delReferente.setDonacion(donacion);
            delReferente.setEmisorId(referente.getId());
            delReferente.setEmisorParte(ParticipantesDonacion.Parte.REFERENTE);
            delReferente.setCodigoHash(passwordEncoder.encode("222222"));
            delReferente.setExpiraEn(expiraEn);
            delReferente.setIntentos(0);
            delReferente.setUsado(false);
            delReferente.setCreadoEn(Instant.now());
            codigoEntregaRepository.save(delReferente);

            return new Long[]{donacion.getId(), donante.getId(), referente.getId()};
        });

        Long donacionId = ids[0];
        Long donanteId = ids[1];
        Long referenteId = ids[2];

        CountDownLatch startLatch = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        AtomicReference<Exception> failure = new AtomicReference<>();

        Runnable donanteVerifica = () -> {
            try {
                startLatch.await();
                entregaService.verificar(donacionId, donanteId, "222222"); // verifies the referente's code
            } catch (Exception e) {
                failure.compareAndSet(null, e);
            }
        };
        Runnable referenteVerifica = () -> {
            try {
                startLatch.await();
                entregaService.verificar(donacionId, referenteId, "111111"); // verifies the donante's code
            } catch (Exception e) {
                failure.compareAndSet(null, e);
            }
        };

        Future<?> f1 = pool.submit(donanteVerifica);
        Future<?> f2 = pool.submit(referenteVerifica);
        startLatch.countDown();
        f1.get(10, TimeUnit.SECONDS);
        f2.get(10, TimeUnit.SECONDS);
        pool.shutdown();

        assertThat(failure.get()).isNull();

        Donacion result = tx.execute(status -> donacionRepository.findById(donacionId).orElseThrow());
        assertThat(result.getEstado()).isEqualTo(EstadoDonacion.ENTREGADA);
        assertThat(result.getConfirmadaDonanteEn()).isNotNull();
        assertThat(result.getConfirmadaReferenteEn()).isNotNull();
        assertThat(result.getFechaEntrega()).isNotNull();
    }
}
