package org.example.asignacion;

import org.example.actividad.ActividadService;
import org.example.acreditacion.AcreditacionService;
import org.example.asignacion.dto.RondaResponse;
import org.example.asignacion.worker.AsignadorClient;
import org.example.asignacion.worker.AsignadorNoDisponibleException;
import org.example.asignacion.worker.AsignadorRespuestaInvalidaException;
import org.example.asignacion.worker.dto.AsignacionSalidaV1;
import org.example.asignacion.worker.dto.CandidatoEntradaV1;
import org.example.asignacion.worker.dto.DesgloseV1;
import org.example.asignacion.worker.dto.EntradaRondaV1;
import org.example.asignacion.worker.dto.PesosV1;
import org.example.asignacion.worker.dto.SalidaRondaV1;
import org.example.domain.Articulo;
import org.example.domain.Asignacion;
import org.example.domain.AsignacionRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoAsignacion;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.EstadoRonda;
import org.example.domain.ModalidadDonacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadArticulo;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.PrioridadNecesidad;
import org.example.domain.Ronda;
import org.example.domain.RondaRepository;
import org.example.user.Administrador;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AD-9 orchestration: candidate eligibility, input derivations, concurrency, worker failure
 * handling, staleness at write time, and the happy path persistence — 5c.1.
 */
@ExtendWith(MockitoExtension.class)
class RondaServiceTest {

    private static final Long ADMIN_ID = 1L;
    private static final Instant NOW = Instant.parse("2026-01-01T12:00:00Z");
    private static final LocalDate HOY = LocalDate.of(2026, 1, 1);

    @Mock
    private DonacionRepository donacionRepository;

    @Mock
    private NecesidadRepository necesidadRepository;

    @Mock
    private AsignacionRepository asignacionRepository;

    @Mock
    private RondaRepository rondaRepository;

    @Mock
    private AcreditacionService acreditacionService;

    @Mock
    private CumplimientoCalculator cumplimientoCalculator;

    @Mock
    private AsignadorClient asignadorClient;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private PlatformTransactionManager transactionManager;

    @Mock
    private TransactionStatus transactionStatus;

    @Mock
    private ActividadService actividadService;

    private RondaService rondaService;
    private EntradaRondaFactory entradaRondaFactory;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        entradaRondaFactory = new EntradaRondaFactory(acreditacionService, cumplimientoCalculator);
        lenient().when(cumplimientoCalculator.calcular()).thenReturn(java.util.Map.of());
        rondaService = new RondaService(donacionRepository, necesidadRepository, asignacionRepository,
                rondaRepository, entradaRondaFactory, asignadorClient, usuarioRepository, clock, transactionManager, actividadService);

        // Runs the transactional callback synchronously against the mocked collaborators. `lenient`
        // because the toResponse-only tests (T6) exercise `rondaService` without ever calling
        // `ejecutar`, so these two stubs go unused there.
        lenient().when(transactionManager.getTransaction(any(TransactionDefinition.class))).thenReturn(transactionStatus);
        lenient().when(rondaRepository.save(any(Ronda.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private Organizacion organizacion(Long id, NivelAcreditacion nivel, boolean conReferente, boolean conCoordenadas) {
        Organizacion org = new Organizacion();
        org.setId(id);
        org.setNombre("Org " + id);
        org.setNivel(nivel);
        if (conReferente) {
            org.setReferente(new Referente(id, "Ref " + id, "ref" + id + "@test.com", "x", true));
        }
        if (conCoordenadas) {
            org.setLatitud(-31.40);
            org.setLongitud(-64.20);
        }
        return org;
    }

    private Necesidad necesidad(Long id, Organizacion org, EstadoNecesidad estado, LocalDate vencimiento) {
        Necesidad n = new Necesidad();
        n.setId(id);
        n.setOrganizacion(org);
        n.setEstado(estado);
        n.setPrioridad(PrioridadNecesidad.MEDIA);
        n.setFechaVencimiento(vencimiento);
        // Feature catalogo-articulos, decision 2: a necesidad with zero articulos is excluded
        // from rondas — every other eligibility fixture in this file needs at least one so it
        // keeps exercising the vencimiento/nivel/referente/coordenadas checks it was written for.
        n.getArticulos().add(unArticuloSolicitado(n));
        return n;
    }

    private NecesidadArticulo unArticuloSolicitado(Necesidad n) {
        Articulo articulo = new Articulo();
        articulo.setId(1L);
        articulo.setNombre("Arroz");
        articulo.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        NecesidadArticulo na = new NecesidadArticulo();
        na.setArticulo(articulo);
        na.setNecesidad(n);
        return na;
    }

    private Donacion donacionPool(Long id) {
        Donante donante = new Donante(2L, "Donante Test", "donante@test.com", "x", true);
        Donacion d = new Donacion();
        d.setId(id);
        d.setDonante(donante);
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setModalidad(ModalidadDonacion.FONDO_COMUN);
        d.setLatitud(-31.41);
        d.setLongitud(-64.18);
        d.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        d.setFechaOferta(HOY.minusDays(5));
        return d;
    }

    private void stubSinAsignaciones(List<Donacion> pool) {
        when(donacionRepository.findByModalidadAndEstadoAndNecesidadIsNull(ModalidadDonacion.FONDO_COMUN, EstadoDonacion.OFRECIDA))
                .thenReturn(pool);
        for (Donacion d : pool) {
            when(asignacionRepository.findOrganizacionIdsByDonacionIdAndEstado(eq(d.getId()), eq(EstadoAsignacion.RECHAZADA)))
                    .thenReturn(List.of());
        }
    }

    // --- Candidate eligibility ---

    @Test
    void excludesN0Organizaciones() {
        Organizacion n0 = organizacion(10L, NivelAcreditacion.N0, true, true);
        Organizacion n1 = organizacion(11L, NivelAcreditacion.N1, true, true);
        Necesidad candidataN0 = necesidad(100L, n0, EstadoNecesidad.ABIERTA, null);
        Necesidad candidataN1 = necesidad(101L, n1, EstadoNecesidad.ABIERTA, null);
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of(candidataN0, candidataN1));
        when(donacionRepository.findUltimaFechaOfertaPorOrganizacion(anyLong(), any())).thenReturn(java.util.Optional.empty());
        stubSinAsignaciones(List.of());
        when(acreditacionService.categoriasPermitidas(NivelAcreditacion.N1)).thenReturn(Set.of());
        when(asignadorClient.ejecutar(any())).thenReturn(salidaVacia());

        Ronda ronda = rondaService.ejecutar(ADMIN_ID);

        assertThat(ronda.getCandidatosConsiderados()).isEqualTo(1);
        ArgumentCaptor<EntradaRondaV1> captor = ArgumentCaptor.forClass(EntradaRondaV1.class);
        verify(asignadorClient).ejecutar(captor.capture());
        assertThat(captor.getValue().getCandidatos()).extracting(CandidatoEntradaV1::getNecesidadId).containsExactly(101L);
    }

    // Feature catalogo-articulos, decision 2: a necesidad with zero articulos carries no
    // matching signal for the worker's articulo-level hard filter and must never appear in
    // candidatas, independent of every other eligibility check.
    @Test
    void excludesNecesidadesSinArticulos() {
        Organizacion org = organizacion(10L, NivelAcreditacion.N1, true, true);
        Necesidad sinArticulos = necesidad(100L, org, EstadoNecesidad.ABIERTA, null);
        sinArticulos.getArticulos().clear();
        Necesidad conArticulos = necesidad(101L, org, EstadoNecesidad.ABIERTA, null);
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of(sinArticulos, conArticulos));
        when(donacionRepository.findUltimaFechaOfertaPorOrganizacion(anyLong(), any())).thenReturn(java.util.Optional.empty());
        stubSinAsignaciones(List.of());
        when(acreditacionService.categoriasPermitidas(NivelAcreditacion.N1)).thenReturn(Set.of());
        when(asignadorClient.ejecutar(any())).thenReturn(salidaVacia());

        Ronda ronda = rondaService.ejecutar(ADMIN_ID);

        assertThat(ronda.getCandidatosConsiderados()).isEqualTo(1);
        ArgumentCaptor<EntradaRondaV1> captor = ArgumentCaptor.forClass(EntradaRondaV1.class);
        verify(asignadorClient).ejecutar(captor.capture());
        assertThat(captor.getValue().getCandidatos()).extracting(CandidatoEntradaV1::getNecesidadId).containsExactly(101L);
    }

    @Test
    void excludesExpiredNecesidades() {
        Organizacion org = organizacion(10L, NivelAcreditacion.N1, true, true);
        Necesidad vencida = necesidad(100L, org, EstadoNecesidad.ABIERTA, HOY.minusDays(1));
        Necesidad vigente = necesidad(101L, org, EstadoNecesidad.ABIERTA, HOY.plusDays(1));
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of(vencida, vigente));
        when(donacionRepository.findUltimaFechaOfertaPorOrganizacion(anyLong(), any())).thenReturn(java.util.Optional.empty());
        stubSinAsignaciones(List.of());
        when(acreditacionService.categoriasPermitidas(any())).thenReturn(Set.of());
        when(asignadorClient.ejecutar(any())).thenReturn(salidaVacia());

        Ronda ronda = rondaService.ejecutar(ADMIN_ID);

        assertThat(ronda.getCandidatosConsiderados()).isEqualTo(1);
    }

    @Test
    void excludesOrganizacionesWithoutReferenteOrCoordinates() {
        Organizacion sinReferente = organizacion(10L, NivelAcreditacion.N1, false, true);
        Organizacion sinCoordenadas = organizacion(11L, NivelAcreditacion.N1, true, false);
        Organizacion elegible = organizacion(12L, NivelAcreditacion.N1, true, true);
        Necesidad n1 = necesidad(100L, sinReferente, EstadoNecesidad.ABIERTA, null);
        Necesidad n2 = necesidad(101L, sinCoordenadas, EstadoNecesidad.ABIERTA, null);
        Necesidad n3 = necesidad(102L, elegible, EstadoNecesidad.ABIERTA, null);
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of(n1, n2, n3));
        when(donacionRepository.findUltimaFechaOfertaPorOrganizacion(anyLong(), any())).thenReturn(java.util.Optional.empty());
        stubSinAsignaciones(List.of());
        when(acreditacionService.categoriasPermitidas(any())).thenReturn(Set.of());
        when(asignadorClient.ejecutar(any())).thenReturn(salidaVacia());

        Ronda ronda = rondaService.ejecutar(ADMIN_ID);

        assertThat(ronda.getCandidatosConsiderados()).isEqualTo(1);
    }

    // --- Input derivations ---

    @Test
    void urgenciaAndDiasDesdeUltimaDonacionMatchDerivations() {
        Organizacion org = organizacion(10L, NivelAcreditacion.N1, true, true);
        Necesidad candidata = necesidad(100L, org, EstadoNecesidad.ABIERTA, null); // MEDIA, no vencimiento -> 0.6
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of(candidata));
        when(donacionRepository.findUltimaFechaOfertaPorOrganizacion(eq(10L), any()))
                .thenReturn(java.util.Optional.of(HOY.minusDays(14)));
        stubSinAsignaciones(List.of());
        when(acreditacionService.categoriasPermitidas(NivelAcreditacion.N1)).thenReturn(Set.of(CategoriaAlimento.NO_PERECEDERO));
        when(asignadorClient.ejecutar(any())).thenReturn(salidaVacia());

        rondaService.ejecutar(ADMIN_ID);

        ArgumentCaptor<EntradaRondaV1> captor = ArgumentCaptor.forClass(EntradaRondaV1.class);
        verify(asignadorClient).ejecutar(captor.capture());
        CandidatoEntradaV1 c = captor.getValue().getCandidatos().get(0);
        assertThat(c.getUrgencia()).isEqualTo(UrgenciaCalculator.calcular(PrioridadNecesidad.MEDIA, null, HOY));
        assertThat(c.getDiasDesdeUltimaDonacion()).isEqualTo(14);
    }

    @Test
    void noHistoryUsesEsperaMaximaDias() {
        Organizacion org = organizacion(10L, NivelAcreditacion.N1, true, true);
        Necesidad candidata = necesidad(100L, org, EstadoNecesidad.ABIERTA, null);
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of(candidata));
        when(donacionRepository.findUltimaFechaOfertaPorOrganizacion(eq(10L), any())).thenReturn(java.util.Optional.empty());
        stubSinAsignaciones(List.of());
        when(acreditacionService.categoriasPermitidas(any())).thenReturn(Set.of());
        when(asignadorClient.ejecutar(any())).thenReturn(salidaVacia());

        rondaService.ejecutar(ADMIN_ID);

        ArgumentCaptor<EntradaRondaV1> captor = ArgumentCaptor.forClass(EntradaRondaV1.class);
        verify(asignadorClient).ejecutar(captor.capture());
        assertThat(captor.getValue().getCandidatos().get(0).getDiasDesdeUltimaDonacion()).isEqualTo(90);
    }

    // --- Exclusions from rejected assignments ---

    @Test
    void exclusionsFromRejectedAssignmentsArePropagated() {
        Donacion donacion = donacionPool(50L);
        when(donacionRepository.findByModalidadAndEstadoAndNecesidadIsNull(ModalidadDonacion.FONDO_COMUN, EstadoDonacion.OFRECIDA))
                .thenReturn(List.of(donacion));
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of());
        when(asignacionRepository.findOrganizacionIdsByDonacionIdAndEstado(50L, EstadoAsignacion.RECHAZADA))
                .thenReturn(List.of(5L, 6L));
        when(asignadorClient.ejecutar(any())).thenReturn(salidaVacia());

        rondaService.ejecutar(ADMIN_ID);

        ArgumentCaptor<EntradaRondaV1> captor = ArgumentCaptor.forClass(EntradaRondaV1.class);
        verify(asignadorClient).ejecutar(captor.capture());
        assertThat(captor.getValue().getDonaciones().get(0).getOrganizacionesExcluidas()).containsExactly(5L, 6L);
    }

    // --- Concurrency ---

    @Test
    void secondConcurrentCallFailsWithRondaEnCurso() throws InterruptedException {
        stubSinAsignaciones(List.of());
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of());
        java.util.concurrent.CountDownLatch workerEntered = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch releaseWorker = new java.util.concurrent.CountDownLatch(1);
        when(asignadorClient.ejecutar(any())).thenAnswer(inv -> {
            workerEntered.countDown();
            releaseWorker.await();
            return salidaVacia();
        });

        Thread first = new Thread(() -> rondaService.ejecutar(ADMIN_ID));
        first.start();
        workerEntered.await();

        assertThatThrownBy(() -> rondaService.ejecutar(ADMIN_ID))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("RONDA_EN_CURSO");

        releaseWorker.countDown();
        first.join();
    }

    // --- Worker failure ---

    @Test
    void workerTimeoutPersistsFallidaRondaAndAnswers503() {
        stubSinAsignaciones(List.of());
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of());
        when(asignadorClient.ejecutar(any())).thenThrow(new AsignadorNoDisponibleException("timeout"));

        assertThatThrownBy(() -> rondaService.ejecutar(ADMIN_ID))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("WORKER_NO_DISPONIBLE");

        ArgumentCaptor<Ronda> captor = ArgumentCaptor.forClass(Ronda.class);
        verify(rondaRepository).save(captor.capture());
        assertThat(captor.getValue().getEstado()).isEqualTo(EstadoRonda.FALLIDA);
        assertThat(captor.getValue().getError()).isEqualTo("WORKER_NO_DISPONIBLE");
        verify(asignacionRepository, never()).save(any());
    }

    @Test
    void workerInvalidResponsePersistsFallidaRondaAndAnswers502() {
        stubSinAsignaciones(List.of());
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of());
        when(asignadorClient.ejecutar(any())).thenThrow(new AsignadorRespuestaInvalidaException("bad payload"));

        assertThatThrownBy(() -> rondaService.ejecutar(ADMIN_ID))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("RESPUESTA_WORKER_INVALIDA");

        ArgumentCaptor<Ronda> captor = ArgumentCaptor.forClass(Ronda.class);
        verify(rondaRepository).save(captor.capture());
        assertThat(captor.getValue().getEstado()).isEqualTo(EstadoRonda.FALLIDA);
        assertThat(captor.getValue().getError()).isEqualTo("RESPUESTA_WORKER_INVALIDA");
    }

    // --- N7: origin of the ronda (manual admin vs scheduled system actor) ---

    @Test
    void manualRondaRecordsOrigenManualAndTheAdmin() {
        stubSinAsignaciones(List.of());
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of());
        when(asignadorClient.ejecutar(any())).thenReturn(salidaVacia());

        Ronda ronda = rondaService.ejecutar(ADMIN_ID);

        assertThat(ronda.getOrigen()).isEqualTo(org.example.domain.OrigenRonda.MANUAL);
        assertThat(ronda.getEjecutadaPor()).isEqualTo(ADMIN_ID);
    }

    @Test
    void automaticRondaRecordsOrigenAutomaticaWithNoUser() {
        stubSinAsignaciones(List.of());
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of());
        when(asignadorClient.ejecutar(any())).thenReturn(salidaVacia());

        Ronda ronda = rondaService.ejecutarAutomatica();

        assertThat(ronda.getOrigen()).isEqualTo(org.example.domain.OrigenRonda.AUTOMATICA);
        assertThat(ronda.getEjecutadaPor()).isNull();
        assertThat(ronda.getEstado()).isEqualTo(EstadoRonda.COMPLETADA);
    }

    @Test
    void automaticRondaWithWorkerDownPersistsFallidaWithNoUserAndAnswers503() {
        stubSinAsignaciones(List.of());
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of());
        when(asignadorClient.ejecutar(any())).thenThrow(new AsignadorNoDisponibleException("down"));

        assertThatThrownBy(() -> rondaService.ejecutarAutomatica())
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("WORKER_NO_DISPONIBLE");

        ArgumentCaptor<Ronda> captor = ArgumentCaptor.forClass(Ronda.class);
        verify(rondaRepository).save(captor.capture());
        assertThat(captor.getValue().getOrigen()).isEqualTo(org.example.domain.OrigenRonda.AUTOMATICA);
        assertThat(captor.getValue().getEjecutadaPor()).isNull();
        assertThat(captor.getValue().getEstado()).isEqualTo(EstadoRonda.FALLIDA);
    }

    @Test
    void toResponseOfAnAutomaticRondaHasOrigenAndNoExecutorLookup() {
        Ronda ronda = new Ronda();
        ronda.setEstado(EstadoRonda.COMPLETADA);
        ronda.setOrigen(org.example.domain.OrigenRonda.AUTOMATICA);

        RondaResponse response = rondaService.toResponse(ronda);

        assertThat(response.origen()).isEqualTo("AUTOMATICA");
        assertThat(response.ejecutadaPor()).isNull();
        assertThat(response.ejecutadaPorNombre()).isNull();
        verify(usuarioRepository, never()).findById(any());
    }

    // --- Staleness between read and write ---

    @Test
    void donationStaleAtWriteTimeIsCountedAsDescartadaNotAssigned() {
        Donacion donacion = donacionPool(50L);
        // Between read and write, the donante cancelled it.
        Donacion donacionCancelada = donacionPool(50L);
        donacionCancelada.setEstado(EstadoDonacion.CANCELADA);

        when(donacionRepository.findByModalidadAndEstadoAndNecesidadIsNull(ModalidadDonacion.FONDO_COMUN, EstadoDonacion.OFRECIDA))
                .thenReturn(List.of(donacion));
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of());
        when(asignacionRepository.findOrganizacionIdsByDonacionIdAndEstado(50L, EstadoAsignacion.RECHAZADA)).thenReturn(List.of());
        when(donacionRepository.findByIdForUpdate(50L)).thenReturn(java.util.Optional.of(donacionCancelada));

        SalidaRondaV1 salida = new SalidaRondaV1();
        salida.setVersion(1);
        AsignacionSalidaV1 a = new AsignacionSalidaV1();
        a.setDonacionId(50L);
        a.setNecesidadId(200L);
        a.setOrganizacionId(20L);
        a.setDesglose(new DesgloseV1());
        salida.setAsignaciones(List.of(a));
        salida.setSinAsignar(List.of());
        when(asignadorClient.ejecutar(any())).thenReturn(salida);

        Ronda ronda = rondaService.ejecutar(ADMIN_ID);

        assertThat(ronda.getAsignadas()).isEqualTo(0);
        assertThat(ronda.getDescartadas()).isEqualTo(1);
        verify(asignacionRepository, never()).save(any());
    }

    @Test
    void donationAlreadyAssignedAtWriteTimeIsCountedAsDescartadaNotReassigned() {
        Donacion donacion = donacionPool(51L);
        // Between read and write, another ronda already gave it a necesidad (still OFRECIDA).
        Donacion donacionYaAsignada = donacionPool(51L);
        Necesidad otraNecesidad = new Necesidad();
        donacionYaAsignada.setNecesidad(otraNecesidad);
        // The solver's target is eligible, so only the already-assigned guard can prevent the write.
        Necesidad destino = necesidad(200L, organizacion(20L, NivelAcreditacion.N1, true, true), EstadoNecesidad.ABIERTA, null);
        lenient().when(necesidadRepository.findById(200L)).thenReturn(java.util.Optional.of(destino));

        when(donacionRepository.findByModalidadAndEstadoAndNecesidadIsNull(ModalidadDonacion.FONDO_COMUN, EstadoDonacion.OFRECIDA))
                .thenReturn(List.of(donacion));
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of());
        when(asignacionRepository.findOrganizacionIdsByDonacionIdAndEstado(51L, EstadoAsignacion.RECHAZADA)).thenReturn(List.of());
        when(donacionRepository.findByIdForUpdate(51L)).thenReturn(java.util.Optional.of(donacionYaAsignada));

        SalidaRondaV1 salida = new SalidaRondaV1();
        salida.setVersion(1);
        AsignacionSalidaV1 a = new AsignacionSalidaV1();
        a.setDonacionId(51L);
        a.setNecesidadId(200L);
        a.setOrganizacionId(20L);
        a.setDesglose(new DesgloseV1());
        salida.setAsignaciones(List.of(a));
        salida.setSinAsignar(List.of());
        when(asignadorClient.ejecutar(any())).thenReturn(salida);

        Ronda ronda = rondaService.ejecutar(ADMIN_ID);

        assertThat(ronda.getAsignadas()).isEqualTo(0);
        assertThat(ronda.getDescartadas()).isEqualTo(1);
        assertThat(donacionYaAsignada.getNecesidad()).isSameAs(otraNecesidad);
        verify(asignacionRepository, never()).save(any());
    }

    // --- Happy path ---

    @Test
    void happyPathPersistsRondaAndAsignacionAndSetsDonacionNecesidad() {
        Organizacion org = organizacion(20L, NivelAcreditacion.N1, true, true);
        Necesidad necesidad = necesidad(200L, org, EstadoNecesidad.ABIERTA, null);
        Donacion donacion = donacionPool(50L);

        when(donacionRepository.findByModalidadAndEstadoAndNecesidadIsNull(ModalidadDonacion.FONDO_COMUN, EstadoDonacion.OFRECIDA))
                .thenReturn(List.of(donacion));
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of(necesidad));
        when(necesidadRepository.findById(200L)).thenReturn(java.util.Optional.of(necesidad));
        when(donacionRepository.findUltimaFechaOfertaPorOrganizacion(anyLong(), any())).thenReturn(java.util.Optional.empty());
        when(asignacionRepository.findOrganizacionIdsByDonacionIdAndEstado(50L, EstadoAsignacion.RECHAZADA)).thenReturn(List.of());
        when(acreditacionService.categoriasPermitidas(any())).thenReturn(Set.of(CategoriaAlimento.NO_PERECEDERO));
        when(donacionRepository.findByIdForUpdate(50L)).thenReturn(java.util.Optional.of(donacion));

        DesgloseV1 desglose = new DesgloseV1(0.33, 0.6, 0.77, 0.16, 0.8888888888888889);
        AsignacionSalidaV1 a = new AsignacionSalidaV1();
        a.setDonacionId(50L);
        a.setNecesidadId(200L);
        a.setOrganizacionId(20L);
        a.setScore(0.71);
        a.setDistanciaKm(2.1);
        a.setCostoOportunidad(0.0);
        a.setDesglose(desglose);
        a.setDeficitFuente("NEUTRAL");
        a.setCodigoRadio("");

        SalidaRondaV1 salida = new SalidaRondaV1();
        salida.setVersion(1);
        salida.setAsignaciones(List.of(a));
        salida.setSinAsignar(List.of());
        salida.setScoreTotal(0.71);
        salida.setPesos(new PesosV1(0.30, 0.25, 0.17, 0.13, null));
        when(asignadorClient.ejecutar(any())).thenReturn(salida);

        Ronda ronda = rondaService.ejecutar(ADMIN_ID);

        assertThat(ronda.getEstado()).isEqualTo(EstadoRonda.COMPLETADA);
        assertThat(ronda.getAsignadas()).isEqualTo(1);
        assertThat(ronda.getSinAsignar()).isEqualTo(0);
        assertThat(ronda.getDescartadas()).isEqualTo(0);
        assertThat(ronda.getScoreTotal()).isEqualTo(0.71);

        assertThat(donacion.getNecesidad()).isEqualTo(necesidad);
        verify(donacionRepository).save(donacion);

        ArgumentCaptor<Asignacion> captor = ArgumentCaptor.forClass(Asignacion.class);
        verify(asignacionRepository).save(captor.capture());
        Asignacion asignacion = captor.getValue();
        assertThat(asignacion.getEstado()).isEqualTo(EstadoAsignacion.PROPUESTA);
        assertThat(asignacion.getDonacion()).isEqualTo(donacion);
        assertThat(asignacion.getNecesidad()).isEqualTo(necesidad);
        assertThat(asignacion.getOrganizacion()).isEqualTo(org);
        assertThat(asignacion.getScore()).isEqualTo(0.71);
        assertThat(asignacion.getTerminoDeficit()).isEqualTo(0.33);
        assertThat(asignacion.getTerminoCumplimiento()).isEqualTo(0.8888888888888889);
        assertThat(asignacion.getDeficitFuente()).isEqualTo("NEUTRAL");
    }

    // --- T6: toResponse resolves the executor's name ---

    @Test
    void toResponseResolvesEjecutadaPorNombreFromUsuarioRepository() {
        Ronda ronda = new Ronda();
        ronda.setEjecutadaPor(ADMIN_ID);
        ronda.setEstado(EstadoRonda.COMPLETADA);
        when(usuarioRepository.findById(ADMIN_ID))
                .thenReturn(java.util.Optional.of(new Administrador(ADMIN_ID, "Ada Admin", "ada@test.com", "x", true)));

        RondaResponse response = rondaService.toResponse(ronda);

        assertThat(response.ejecutadaPorNombre()).isEqualTo("Ada Admin");
    }

    @Test
    void toResponseIsNullSafeWhenExecutorUserNoLongerExists() {
        Ronda ronda = new Ronda();
        ronda.setEjecutadaPor(999L);
        ronda.setEstado(EstadoRonda.COMPLETADA);
        when(usuarioRepository.findById(999L)).thenReturn(java.util.Optional.empty());

        RondaResponse response = rondaService.toResponse(ronda);

        assertThat(response.ejecutadaPorNombre()).isNull();
    }

    private SalidaRondaV1 salidaVacia() {
        SalidaRondaV1 salida = new SalidaRondaV1();
        salida.setVersion(1);
        salida.setAsignaciones(List.of());
        salida.setSinAsignar(List.of());
        salida.setScoreTotal(0.0);
        return salida;
    }

    @Test
    void ejecutar_recordsRondaWithTheAdminAsActor() {
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of());
        stubSinAsignaciones(List.of());
        when(asignadorClient.ejecutar(any())).thenReturn(salidaVacia());

        rondaService.ejecutar(ADMIN_ID);

        org.mockito.ArgumentCaptor<ActividadService.Registro> captor =
                org.mockito.ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService).registrarAislado(captor.capture());
        assertThat(captor.getValue().accion()).isEqualTo(org.example.actividad.TipoActividad.RONDA_EJECUTADA);
        assertThat(captor.getValue().actorId()).isEqualTo(ADMIN_ID);
        assertThat(captor.getValue().esSistema()).isFalse();
    }

    @Test
    void ejecutarAutomatica_recordsRondaAsSystem() {
        when(necesidadRepository.findByEstadoInWithOrganizacion(any())).thenReturn(List.of());
        stubSinAsignaciones(List.of());
        when(asignadorClient.ejecutar(any())).thenReturn(salidaVacia());

        rondaService.ejecutarAutomatica();

        org.mockito.ArgumentCaptor<ActividadService.Registro> captor =
                org.mockito.ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividadService).registrarAislado(captor.capture());
        assertThat(captor.getValue().esSistema()).isTrue();
    }
}
