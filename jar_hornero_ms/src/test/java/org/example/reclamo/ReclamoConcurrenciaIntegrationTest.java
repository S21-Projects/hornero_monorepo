package org.example.reclamo;

import org.example.domain.EstadoOrganizacion;
import org.example.domain.EstadoReclamo;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.ReclamoOrganizacionRepository;
import org.example.organizacion.OrganizacionService;
import org.example.domain.RolReclamo;
import org.example.reclamo.dto.CrearReclamoRequest;
import org.example.reclamo.dto.ReclamoResponse;
import org.example.user.Administrador;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.dao.OptimisticLockingFailureException;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

/**
 * Two admins approve two different claims on the same unclaimed organizacion at once. A barrier
 * placed just before each transaction assigns the organizacion (both already read it as
 * SIN_RECLAMAR, same version), before either writes, forces the interleaving. Exactly one approval may win; the
 * other must fail optimistically (or on the state re-check) instead of overwriting the first
 * referente. Real repositories, no test-level transaction.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class ReclamoConcurrenciaIntegrationTest {

    @Autowired private ReclamoService reclamoService;
    @Autowired private ReclamoOrganizacionRepository reclamoRepository;
    @Autowired private OrganizacionRepository organizacionRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @SpyBean private OrganizacionService organizacionService;

    @Test
    void twoConcurrentApprovalsOnTheSameOrganizacion_exactlyOneWins() throws Exception {
        String s = UUID.randomUUID().toString().substring(0, 8);
        Administrador admin1 = (Administrador) usuarioRepository.save(
                new Administrador(null, "Admin1 " + s, "adm1-" + s + "@test.com", "hash", true));
        Administrador admin2 = (Administrador) usuarioRepository.save(
                new Administrador(null, "Admin2 " + s, "adm2-" + s + "@test.com", "hash", true));
        Referente ana = (Referente) usuarioRepository.save(
                new Referente(null, "Ana " + s, "ana-" + s + "@test.com", "hash", true));
        Referente beto = (Referente) usuarioRepository.save(
                new Referente(null, "Beto " + s, "beto-" + s + "@test.com", "hash", true));

        Organizacion org = new Organizacion();
        org.setNombre("Comedor concurrente " + s);
        org.setSlug("comedor-concurrente-" + s);
        org.setEstado(EstadoOrganizacion.SIN_RECLAMAR);
        org.setNivel(NivelAcreditacion.N0);
        org = organizacionRepository.save(org);
        Long orgId = org.getId();

        Long reclamoAna = reclamoService.crear(pedido(orgId, ana), ana.getId()).id();
        Long reclamoBeto = reclamoService.crear(pedido(orgId, beto), beto.getId()).id();

        CyclicBarrier ambosLeyeron = new CyclicBarrier(2);
        ThreadLocal<Boolean> yaEspero = ThreadLocal.withInitial(() -> false);
        doAnswer(inv -> {
            if (!yaEspero.get()) {
                yaEspero.set(true);
                ambosLeyeron.await(10, TimeUnit.SECONDS);
            }
            return inv.callRealMethod();
        }).when(organizacionService).asignarPorReclamo(any(), any(), any());

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Callable<ReclamoResponse>> tareas = new ArrayList<>();
            tareas.add(() -> reclamoService.aprobar(reclamoAna, admin1.getId()));
            tareas.add(() -> reclamoService.aprobar(reclamoBeto, admin2.getId()));
            List<Future<ReclamoResponse>> futuros = pool.invokeAll(tareas, 30, TimeUnit.SECONDS);

            int ganadores = 0;
            int conflictos = 0;
            for (Future<ReclamoResponse> futuro : futuros) {
                try {
                    futuro.get();
                    ganadores++;
                } catch (ExecutionException e) {
                    assertThat(e.getCause()).isInstanceOf(OptimisticLockingFailureException.class);
                    conflictos++;
                }
            }
            assertThat(ganadores).isEqualTo(1);
            assertThat(conflictos).isEqualTo(1);

            Organizacion final_ = organizacionRepository.findById(orgId).orElseThrow();
            assertThat(final_.getEstado()).isEqualTo(EstadoOrganizacion.PENDIENTE);
            assertThat(final_.getReferente().getId()).isIn(ana.getId(), beto.getId());
            long aprobados = reclamoRepository.findAll().stream()
                    .filter(r -> r.getOrganizacion().getId().equals(orgId))
                    .filter(r -> r.getEstado() == EstadoReclamo.APROBADO).count();
            assertThat(aprobados).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    private static CrearReclamoRequest pedido(Long orgId, Referente r) {
        return new CrearReclamoRequest(orgId, RolReclamo.RESPONSABLE, "351 555 0000", null,
                List.of("reclamo-evidencia/" + orgId + "/" + r.getId() + "/1.jpg"));
    }
}
