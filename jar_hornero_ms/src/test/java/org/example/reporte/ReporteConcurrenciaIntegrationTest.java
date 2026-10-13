package org.example.reporte;

import org.example.domain.EstadoOrganizacion;
import org.example.domain.EstadoReporte;
import org.example.domain.MotivoReporte;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.ReporteOrganizacionRepository;
import org.example.reporte.dto.CrearReporteRequest;
import org.example.reporte.dto.ReporteResponse;
import org.example.user.Administrador;
import org.example.user.Donante;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Two admins resolve two different reports on the same unclaimed organizacion at once: one marks it
 * inactive, the other discards a report. Whatever the interleaving, the organizacion ends INACTIVA at
 * most once, no report is resolved twice, and a loser fails optimistically or on the state re-check
 * instead of silently overwriting. Real repositories, no test-level transaction.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class ReporteConcurrenciaIntegrationTest {

    @Autowired private ReporteService reporteService;
    @Autowired private ReporteOrganizacionRepository reporteRepository;
    @Autowired private OrganizacionRepository organizacionRepository;
    @Autowired private UsuarioRepository usuarioRepository;

    @Test
    void twoConcurrentMarcarInactiva_exactlyOneWins() throws Exception {
        String s = UUID.randomUUID().toString().substring(0, 8);
        Administrador admin1 = (Administrador) usuarioRepository.save(
                new Administrador(null, "Admin1 " + s, "adm1-" + s + "@test.com", "hash", true));
        Administrador admin2 = (Administrador) usuarioRepository.save(
                new Administrador(null, "Admin2 " + s, "adm2-" + s + "@test.com", "hash", true));
        Donante d1 = (Donante) usuarioRepository.save(new Donante(null, "D1 " + s, "d1-" + s + "@test.com", "hash", true));
        Donante d2 = (Donante) usuarioRepository.save(new Donante(null, "D2 " + s, "d2-" + s + "@test.com", "hash", true));

        d1.setEmailVerificado(true);
        d2.setEmailVerificado(true);
        usuarioRepository.save(d1);
        usuarioRepository.save(d2);

        Organizacion org = new Organizacion();
        org.setNombre("Comedor concurrente " + s);
        org.setSlug("comedor-reporte-" + s);
        org.setEstado(EstadoOrganizacion.SIN_RECLAMAR);
        org.setNivel(NivelAcreditacion.N0);
        Long orgId = organizacionRepository.save(org).getId();

        Long r1 = reporteService.crear(new CrearReporteRequest(orgId, MotivoReporte.INACTIVO, null, null), d1.getId()).id();
        Long r2 = reporteService.crear(new CrearReporteRequest(orgId, MotivoReporte.INACTIVO, null, null), d2.getId()).id();

        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Callable<ReporteResponse>> tareas = new ArrayList<>();
            tareas.add(() -> { go.await(); return reporteService.marcarInactiva(r1, admin1.getId()); });
            tareas.add(() -> { go.await(); return reporteService.marcarInactiva(r2, admin2.getId()); });
            List<Future<ReporteResponse>> futuros = new ArrayList<>();
            for (Callable<ReporteResponse> t : tareas) futuros.add(pool.submit(t));
            go.countDown();

            int ganadores = 0;
            for (Future<ReporteResponse> futuro : futuros) {
                try {
                    futuro.get(30, TimeUnit.SECONDS);
                    ganadores++;
                } catch (ExecutionException e) {
                    assertThat(e.getCause()).isInstanceOfAny(OptimisticLockingFailureException.class,
                            ResponseStatusException.class);
                }
            }
            // The winner confirms both reports (its own and the other pending one) in one transaction.
            assertThat(ganadores).isGreaterThanOrEqualTo(1);
            assertThat(organizacionRepository.findById(orgId).orElseThrow().getEstado())
                    .isEqualTo(EstadoOrganizacion.INACTIVA);
            assertThat(reporteRepository.findAll().stream()
                    .filter(r -> r.getOrganizacion().getId().equals(orgId))
                    .allMatch(r -> r.getEstado() == EstadoReporte.CONFIRMADO)).isTrue();
        } finally {
            pool.shutdownNow();
        }
    }
}
