package org.example.asignacion;

import org.example.asignacion.dto.RondaFondoResponse;
import org.example.asignacion.dto.RondaResponse;
import org.example.asignacion.worker.AsignadorClient;
import org.example.asignacion.worker.AsignadorNoDisponibleException;
import org.example.asignacion.worker.AsignadorRespuestaInvalidaException;
import org.example.asignacion.worker.dto.AsignacionSalidaV1;
import org.example.asignacion.worker.dto.DesgloseV1;
import org.example.asignacion.worker.dto.EntradaRondaV1;
import org.example.asignacion.worker.dto.PesosV1;
import org.example.asignacion.worker.dto.SalidaRondaV1;
import org.example.domain.Asignacion;
import org.example.domain.AsignacionRepository;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoAsignacion;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.EstadoRonda;
import org.example.domain.ModalidadDonacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.Ronda;
import org.example.domain.RondaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Orchestrates one ronda (AD-9): read candidates under a transaction, call the worker outside any
 * transaction, then persist the result under a second transaction. A {@link ReentrantLock} bounds
 * concurrent execution to one ronda at a time (the MS is a single instance on the Pi).
 */
@Service
public class RondaService {

    private static final Set<EstadoNecesidad> ESTADOS_ELEGIBLES = EnumSet.of(EstadoNecesidad.ABIERTA, EstadoNecesidad.EN_PROGRESO);
    private static final Set<EstadoDonacion> ESTADOS_EXCLUIDOS_HISTORIAL = EnumSet.of(EstadoDonacion.CANCELADA, EstadoDonacion.RECHAZADA);
    private static final long ESPERA_MAXIMA_DIAS = 90;
    private static final int VERSION_CONTRATO = 1;

    private final DonacionRepository donacionRepository;
    private final NecesidadRepository necesidadRepository;
    private final AsignacionRepository asignacionRepository;
    private final RondaRepository rondaRepository;
    private final EntradaRondaFactory entradaRondaFactory;
    private final AsignadorClient asignadorClient;
    private final Clock clock;
    private final TransactionTemplate transactionTemplate;
    private final ReentrantLock lock = new ReentrantLock();

    public RondaService(DonacionRepository donacionRepository,
                         NecesidadRepository necesidadRepository,
                         AsignacionRepository asignacionRepository,
                         RondaRepository rondaRepository,
                         EntradaRondaFactory entradaRondaFactory,
                         AsignadorClient asignadorClient,
                         Clock clock,
                         PlatformTransactionManager transactionManager) {
        this.donacionRepository = donacionRepository;
        this.necesidadRepository = necesidadRepository;
        this.asignacionRepository = asignacionRepository;
        this.rondaRepository = rondaRepository;
        this.entradaRondaFactory = entradaRondaFactory;
        this.asignadorClient = asignadorClient;
        this.clock = clock;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public Ronda ejecutar(Long adminId) {
        if (!lock.tryLock()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "RONDA_EN_CURSO");
        }
        try {
            Lectura lectura = transactionTemplate.execute(status -> leer());

            SalidaRondaV1 salida;
            try {
                salida = asignadorClient.ejecutar(entradaRondaFactory.crear(
                        lectura.pool(), lectura.candidatas(), lectura.diasDesdeUltimaDonacionPorOrganizacion(),
                        lectura.organizacionesExcluidasPorDonacion(), LocalDate.now(clock)));
            } catch (AsignadorNoDisponibleException e) {
                transactionTemplate.executeWithoutResult(status ->
                        persistirFallida(adminId, lectura, "WORKER_NO_DISPONIBLE"));
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "WORKER_NO_DISPONIBLE");
            } catch (AsignadorRespuestaInvalidaException e) {
                transactionTemplate.executeWithoutResult(status ->
                        persistirFallida(adminId, lectura, "RESPUESTA_WORKER_INVALIDA"));
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "RESPUESTA_WORKER_INVALIDA");
            }

            return transactionTemplate.execute(status -> persistirResultado(adminId, lectura, salida));
        } finally {
            lock.unlock();
        }
    }

    /** {@code GET /api/rondas}: most recent first. */
    public Page<RondaResponse> listar(Pageable pageable) {
        return rondaRepository.findAllByOrderByEjecutadaEnDesc(pageable).map(this::toResponse);
    }

    /** {@code GET /api/rondas/{id}}. */
    public RondaResponse detalle(Long id) {
        Ronda ronda = rondaRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ronda not found"));
        return toResponse(ronda);
    }

    /** {@code GET /api/rondas/fondo}: pool size and the oldest waiting donación, before triggering a ronda. */
    public RondaFondoResponse fondoEstado() {
        List<Donacion> pool = donacionRepository.findByModalidadAndEstadoAndNecesidadIsNull(
                ModalidadDonacion.FONDO_COMUN, EstadoDonacion.OFRECIDA);
        LocalDate masAntigua = pool.stream()
                .map(Donacion::getFechaOferta)
                .filter(java.util.Objects::nonNull)
                .min(LocalDate::compareTo)
                .orElse(null);
        return new RondaFondoResponse(pool.size(), masAntigua);
    }

    public RondaResponse toResponse(Ronda r) {
        return new RondaResponse(
                r.getId(), r.getEjecutadaEn(), r.getFinalizadaEn(), r.getEjecutadaPor(),
                r.getEstado().name(), r.getError(), r.getVersionContrato(),
                r.getDonacionesConsideradas(), r.getCandidatosConsiderados(),
                r.getAsignadas(), r.getSinAsignar(), r.getDescartadas(), r.getScoreTotal(),
                r.getPesoDeficit(), r.getPesoUrgencia(), r.getPesoProximidad(),
                r.getPesoEspera(), r.getPesoCumplimiento());
    }

    private Lectura leer() {
        List<Donacion> pool = donacionRepository.findByModalidadAndEstadoAndNecesidadIsNull(
                ModalidadDonacion.FONDO_COMUN, EstadoDonacion.OFRECIDA);

        LocalDate hoy = LocalDate.now(clock);
        List<Necesidad> candidatas = necesidadRepository.findByEstadoInWithOrganizacion(ESTADOS_ELEGIBLES).stream()
                .filter(n -> esCandidataElegible(n, hoy))
                .toList();

        Map<Long, Long> diasDesdeUltimaDonacionPorOrganizacion = new HashMap<>();
        for (Necesidad n : candidatas) {
            Long orgId = n.getOrganizacion().getId();
            diasDesdeUltimaDonacionPorOrganizacion.computeIfAbsent(orgId, id ->
                    donacionRepository.findUltimaFechaOfertaPorOrganizacion(id, ESTADOS_EXCLUIDOS_HISTORIAL)
                            .map(fecha -> ChronoUnit.DAYS.between(fecha, hoy))
                            .orElse(ESPERA_MAXIMA_DIAS));
        }

        Map<Long, List<Long>> organizacionesExcluidasPorDonacion = new HashMap<>();
        for (Donacion d : pool) {
            organizacionesExcluidasPorDonacion.put(d.getId(),
                    asignacionRepository.findOrganizacionIdsByDonacionIdAndEstado(d.getId(), EstadoAsignacion.RECHAZADA));
        }

        return new Lectura(pool, candidatas, diasDesdeUltimaDonacionPorOrganizacion, organizacionesExcluidasPorDonacion);
    }

    /**
     * AD-9 eligibility: not past {@code fechaVencimiento}, organización above N0 (an empty
     * {@code categoriasPermitidas(N0)} is "uncapped" for the worker — must never reach it), with a
     * referente and coordinates.
     */
    private boolean esCandidataElegible(Necesidad n, LocalDate hoy) {
        if (n.getFechaVencimiento() != null && n.getFechaVencimiento().isBefore(hoy)) {
            return false;
        }
        Organizacion org = n.getOrganizacion();
        if (org == null) {
            return false;
        }
        NivelAcreditacion nivel = org.getNivel();
        if (nivel == null || nivel == NivelAcreditacion.N0) {
            return false;
        }
        if (org.getReferente() == null) {
            return false;
        }
        return org.getLatitud() != null && org.getLongitud() != null;
    }

    private void persistirFallida(Long adminId, Lectura lectura, String error) {
        Ronda ronda = new Ronda();
        ronda.setEjecutadaEn(clock.instant());
        ronda.setFinalizadaEn(clock.instant());
        ronda.setEjecutadaPor(adminId);
        ronda.setEstado(EstadoRonda.FALLIDA);
        ronda.setError(error);
        ronda.setVersionContrato(VERSION_CONTRATO);
        ronda.setDonacionesConsideradas(lectura.pool().size());
        ronda.setCandidatosConsiderados(lectura.candidatas().size());
        ronda.setAsignadas(0);
        ronda.setSinAsignar(0);
        ronda.setDescartadas(0);
        rondaRepository.save(ronda);
    }

    private Ronda persistirResultado(Long adminId, Lectura lectura, SalidaRondaV1 salida) {
        Ronda ronda = new Ronda();
        ronda.setEjecutadaEn(clock.instant());
        ronda.setEjecutadaPor(adminId);
        ronda.setEstado(EstadoRonda.COMPLETADA);
        ronda.setVersionContrato(VERSION_CONTRATO);
        ronda.setDonacionesConsideradas(lectura.pool().size());
        ronda.setCandidatosConsiderados(lectura.candidatas().size());
        ronda.setScoreTotal(salida.getScoreTotal());
        PesosV1 pesos = salida.getPesos();
        if (pesos != null) {
            ronda.setPesoDeficit(pesos.getDeficit());
            ronda.setPesoUrgencia(pesos.getUrgencia());
            ronda.setPesoProximidad(pesos.getProximidad());
            ronda.setPesoEspera(pesos.getEspera());
            ronda.setPesoCumplimiento(pesos.getCumplimiento());
        }
        Ronda rondaGuardada = rondaRepository.save(ronda);

        int asignadas = 0;
        int descartadas = 0;
        List<AsignacionSalidaV1> asignacionesSalida = salida.getAsignaciones() != null ? salida.getAsignaciones() : List.of();
        for (AsignacionSalidaV1 a : asignacionesSalida) {
            Donacion donacion = donacionRepository.findByIdForUpdate(a.getDonacionId()).orElse(null);
            if (donacion == null || donacion.getEstado() != EstadoDonacion.OFRECIDA || donacion.getNecesidad() != null) {
                // Stale at write time: cancelled, reassigned, or already resolved between read and write.
                descartadas++;
                continue;
            }
            Necesidad necesidad = necesidadRepository.findById(a.getNecesidadId()).orElse(null);
            if (necesidad == null || !ESTADOS_ELEGIBLES.contains(necesidad.getEstado())) {
                descartadas++;
                continue;
            }

            donacion.setNecesidad(necesidad);
            donacionRepository.save(donacion);

            asignacionRepository.save(nuevaAsignacion(rondaGuardada, donacion, necesidad, a));
            asignadas++;
        }

        rondaGuardada.setAsignadas(asignadas);
        rondaGuardada.setSinAsignar(salida.getSinAsignar() != null ? salida.getSinAsignar().size() : 0);
        rondaGuardada.setDescartadas(descartadas);
        rondaGuardada.setFinalizadaEn(clock.instant());
        return rondaRepository.save(rondaGuardada);
    }

    private Asignacion nuevaAsignacion(Ronda ronda, Donacion donacion, Necesidad necesidad, AsignacionSalidaV1 a) {
        Asignacion asignacion = new Asignacion();
        asignacion.setRonda(ronda);
        asignacion.setDonacion(donacion);
        asignacion.setNecesidad(necesidad);
        asignacion.setOrganizacion(necesidad.getOrganizacion());
        asignacion.setEstado(EstadoAsignacion.PROPUESTA);
        asignacion.setCreadaEn(clock.instant());
        asignacion.setScore(a.getScore());
        asignacion.setCostoOportunidad(a.getCostoOportunidad());
        asignacion.setDistanciaKm(a.getDistanciaKm());
        DesgloseV1 desglose = a.getDesglose();
        if (desglose != null) {
            asignacion.setTerminoDeficit(desglose.getDeficit());
            asignacion.setTerminoUrgencia(desglose.getUrgencia());
            asignacion.setTerminoProximidad(desglose.getProximidad());
            asignacion.setTerminoEspera(desglose.getEspera());
            asignacion.setTerminoCumplimiento(desglose.getCumplimiento());
        }
        asignacion.setDeficitFuente(a.getDeficitFuente());
        asignacion.setCodigoRadio(a.getCodigoRadio());
        return asignacion;
    }

    private record Lectura(List<Donacion> pool,
                            List<Necesidad> candidatas,
                            Map<Long, Long> diasDesdeUltimaDonacionPorOrganizacion,
                            Map<Long, List<Long>> organizacionesExcluidasPorDonacion) {

        private Lectura {
            pool = pool != null ? pool : new ArrayList<>();
            candidatas = candidatas != null ? candidatas : new ArrayList<>();
        }
    }
}
