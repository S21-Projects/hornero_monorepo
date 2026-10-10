package org.example.asignacion;

import org.example.asignacion.dto.RondaFondoResponse;
import org.example.asignacion.dto.RondaResponse;
import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
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
import org.example.domain.OrigenRonda;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.Ronda;
import org.example.domain.RondaRepository;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
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
    private final UsuarioRepository usuarioRepository;
    private final Clock clock;
    private final TransactionTemplate transactionTemplate;
    private final ActividadService actividadService;
    private final ReentrantLock lock = new ReentrantLock();

    public RondaService(DonacionRepository donacionRepository,
                         NecesidadRepository necesidadRepository,
                         AsignacionRepository asignacionRepository,
                         RondaRepository rondaRepository,
                         EntradaRondaFactory entradaRondaFactory,
                         AsignadorClient asignadorClient,
                         UsuarioRepository usuarioRepository,
                         Clock clock,
                         PlatformTransactionManager transactionManager,
                         ActividadService actividadService) {
        this.donacionRepository = donacionRepository;
        this.necesidadRepository = necesidadRepository;
        this.asignacionRepository = asignacionRepository;
        this.rondaRepository = rondaRepository;
        this.entradaRondaFactory = entradaRondaFactory;
        this.asignadorClient = asignadorClient;
        this.usuarioRepository = usuarioRepository;
        this.clock = clock;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.actividadService = actividadService;
    }

    /** Manual trigger ({@code POST /api/rondas}). */
    public Ronda ejecutar(Long adminId) {
        return ejecutar(adminId, OrigenRonda.MANUAL);
    }

    /** Scheduled trigger (N7): same logic, no user. */
    public Ronda ejecutarAutomatica() {
        return ejecutar(null, OrigenRonda.AUTOMATICA);
    }

    private Ronda ejecutar(Long adminId, OrigenRonda origen) {
        if (!lock.tryLock()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "RONDA_EN_CURSO");
        }
        try {
            // Build the worker input (EntradaRondaV1) inside the same read transaction as `leer()`
            // (AD-9): EntradaRondaFactory walks lazy collections (Donacion.lineas,
            // Necesidad.articulos) that need an open Hibernate session. The HTTP call to the worker
            // still happens outside any transaction, below, per AD-9's intent.
            LecturaConEntrada lecturaConEntrada = transactionTemplate.execute(status -> {
                Lectura l = leer();
                EntradaRondaV1 e = entradaRondaFactory.crear(l.pool(), l.candidatas(),
                        l.diasDesdeUltimaDonacionPorOrganizacion(), l.organizacionesExcluidasPorDonacion(),
                        LocalDate.now(clock));
                return new LecturaConEntrada(l, e);
            });
            Lectura lectura = lecturaConEntrada.lectura();

            SalidaRondaV1 salida;
            try {
                salida = asignadorClient.ejecutar(lecturaConEntrada.entrada());
            } catch (AsignadorNoDisponibleException e) {
                transactionTemplate.executeWithoutResult(status ->
                        persistirFallida(adminId, origen, lectura, "WORKER_NO_DISPONIBLE"));
                registrar(adminId, origen, null, "WORKER_NO_DISPONIBLE");
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "WORKER_NO_DISPONIBLE");
            } catch (AsignadorRespuestaInvalidaException e) {
                transactionTemplate.executeWithoutResult(status ->
                        persistirFallida(adminId, origen, lectura, "RESPUESTA_WORKER_INVALIDA"));
                registrar(adminId, origen, null, "RESPUESTA_WORKER_INVALIDA");
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "RESPUESTA_WORKER_INVALIDA");
            }

            Ronda ronda = transactionTemplate.execute(status -> persistirResultado(adminId, origen, lectura, salida));
            registrar(adminId, origen, ronda, null);
            return ronda;
        } finally {
            lock.unlock();
        }
    }

    /**
     * N10: the ronda itself was committed by the template above, so the audit row is written
     * afterwards through the isolated, never-throwing path: a log failure must not turn a finished
     * ronda into an error response.
     */
    private void registrar(Long adminId, OrigenRonda origen, Ronda ronda, String error) {
        ActividadService.Registro registro = ActividadService.Registro.de(TipoActividad.RONDA_EJECUTADA);
        if (adminId != null) {
            registro.actor(adminId, "ADMINISTRADOR");
        } else {
            registro.sistema();
        }
        if (error != null) {
            registro.fallo().detalle("origen " + origen + ": " + error);
        } else {
            registro.detalle("origen " + origen + ", asignadas " + ronda.getAsignadas());
            if (ronda.getId() != null) {
                registro.entidad("RONDA", ronda.getId());
            }
        }
        actividadService.registrarAislado(registro);
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
        String ejecutadaPorNombre = r.getEjecutadaPor() != null
                ? usuarioRepository.findById(r.getEjecutadaPor()).map(Usuario::getNombre).orElse(null)
                : null;
        return new RondaResponse(
                r.getId(), r.getEjecutadaEn(), r.getFinalizadaEn(), r.getEjecutadaPor(), ejecutadaPorNombre, r.getOrigen().name(),
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
     * referente and coordinates. Feature catalogo-articulos, decision 2: a necesidad with zero
     * selected articulos is excluded from rondas — it carries no matching signal for the worker's
     * articulo-level hard filter.
     */
    private boolean esCandidataElegible(Necesidad n, LocalDate hoy) {
        if (n.getArticulos() == null || n.getArticulos().isEmpty()) {
            return false;
        }
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

    private void persistirFallida(Long adminId, OrigenRonda origen, Lectura lectura, String error) {
        Ronda ronda = new Ronda();
        ronda.setEjecutadaEn(clock.instant());
        ronda.setFinalizadaEn(clock.instant());
        ronda.setEjecutadaPor(adminId);
        ronda.setOrigen(origen);
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

    private Ronda persistirResultado(Long adminId, OrigenRonda origen, Lectura lectura, SalidaRondaV1 salida) {
        Ronda ronda = new Ronda();
        ronda.setEjecutadaEn(clock.instant());
        ronda.setEjecutadaPor(adminId);
        ronda.setOrigen(origen);
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

    private record LecturaConEntrada(Lectura lectura, EntradaRondaV1 entrada) {
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
