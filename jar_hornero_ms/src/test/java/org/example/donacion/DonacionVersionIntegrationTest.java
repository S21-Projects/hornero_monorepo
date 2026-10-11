package org.example.donacion;

import org.example.actividad.ActividadService;
import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.ModalidadDonacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.example.domain.UnidadArticulo;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.dao.OptimisticLockingFailureException;

import java.time.LocalDate;
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
 * N11 part B: {@code @Version} on {@link Donacion}. Real repositories, no test-level transaction.
 * Two different transitions (the referente accepting vs the donante cancelling) read the same
 * OFRECIDA row before either commits; the barrier placed in the activity-log call (which both run
 * after their read and before their commit) forces that interleaving deterministically. Exactly one
 * commit may win, the other must fail with an optimistic-locking error instead of silently
 * overwriting the first.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class DonacionVersionIntegrationTest {

    @Autowired
    private DonacionService donacionService;
    @Autowired
    private DonacionRepository donacionRepository;
    @Autowired
    private NecesidadRepository necesidadRepository;
    @Autowired
    private OrganizacionRepository organizacionRepository;
    @Autowired
    private ArticuloRepository articuloRepository;
    @Autowired
    private UsuarioRepository usuarioRepository;
    @SpyBean
    private ActividadService actividadService;

    private record Fixture(Long donacionId, Long referenteId, Long donanteId) {
    }

    private Fixture crearDonacionOfrecida() {
        String sufijo = UUID.randomUUID().toString().substring(0, 8);
        Referente referente = (Referente) usuarioRepository.save(
                new Referente(null, "Ref " + sufijo, "ref-" + sufijo + "@test.com", "hash", true));
        Donante donante = (Donante) usuarioRepository.save(
                new Donante(null, "Don " + sufijo, "don-" + sufijo + "@test.com", "hash", true));

        Organizacion org = new Organizacion();
        org.setNombre("Org version " + sufijo);
        org.setValidada(true);
        org.setNivel(NivelAcreditacion.N1);
        org.setReferente(referente);
        org.setLatitud(-31.40);
        org.setLongitud(-64.20);
        org = organizacionRepository.save(org);

        Articulo arroz = new Articulo();
        arroz.setNombre("Arroz version " + sufijo);
        arroz.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        arroz.setUnidad(UnidadArticulo.KG);
        arroz.setActivo(true);
        articuloRepository.save(arroz);

        Necesidad necesidad = new Necesidad();
        necesidad.setOrganizacion(org);
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setPrioridad(PrioridadNecesidad.MEDIA);
        necesidad.setFechaVencimiento(LocalDate.now().plusDays(30));
        necesidad = necesidadRepository.save(necesidad);

        Donacion d = new Donacion();
        d.setDonante(donante);
        d.setNecesidad(necesidad);
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setModalidad(ModalidadDonacion.DIRECTA);
        d.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        d.setFechaOferta(LocalDate.now());
        d = donacionRepository.save(d);
        return new Fixture(d.getId(), referente.getId(), donante.getId());
    }

    @Test
    void versionStartsAtZeroAndAdvancesOnUpdate() {
        Fixture f = crearDonacionOfrecida();
        Donacion antes = donacionRepository.findById(f.donacionId()).orElseThrow();
        assertThat(antes.getVersion()).isEqualTo(0L);

        donacionService.actualizarEstado(f.donacionId(), EstadoDonacion.CANCELADA, f.donanteId());

        assertThat(donacionRepository.findById(f.donacionId()).orElseThrow().getVersion()).isEqualTo(1L);
    }

    @Test
    void twoConcurrentTransitions_exactlyOneWinsTheOtherFailsOptimistically() throws Exception {
        Fixture f = crearDonacionOfrecida();
        CyclicBarrier ambosLeyeron = new CyclicBarrier(2);
        doAnswer(inv -> {
            ambosLeyeron.await(10, TimeUnit.SECONDS);
            return inv.callRealMethod();
        }).when(actividadService).registrar(any());

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Callable<DonacionResponse>> tareas = new ArrayList<>();
            tareas.add(() -> donacionService.decidir(f.donacionId(), EstadoDonacion.ACEPTADA, f.referenteId()));
            tareas.add(() -> donacionService.actualizarEstado(f.donacionId(), EstadoDonacion.CANCELADA, f.donanteId()));
            List<Future<DonacionResponse>> futuros = pool.invokeAll(tareas, 30, TimeUnit.SECONDS);

            int ganadores = 0;
            int conflictos = 0;
            for (Future<DonacionResponse> futuro : futuros) {
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
            EstadoDonacion finalEstado = donacionRepository.findById(f.donacionId()).orElseThrow().getEstado();
            assertThat(finalEstado).isIn(EstadoDonacion.ACEPTADA, EstadoDonacion.CANCELADA);
        } finally {
            pool.shutdownNow();
        }
    }
}
