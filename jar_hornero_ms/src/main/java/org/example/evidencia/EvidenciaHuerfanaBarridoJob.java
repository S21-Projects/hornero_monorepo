package org.example.evidencia;

import lombok.extern.slf4j.Slf4j;
import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.domain.ReclamoOrganizacionRepository;
import org.example.evidencia.EvidenciaAlmacen.ObjetoAlmacenado;
import org.example.evidencia.EvidenciaAlmacen.ResultadoBorrado;
import org.example.reclamo.ClaveEvidenciaReclamo;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Nightly sweep of claim evidence objects that no claim row references any more (uploads that were
 * never attached, deletions that failed after an anonymization). It deletes only objects that are
 * under {@code reclamo-evidencia/}, match the key pattern, are unreferenced and older than the
 * grace period (so an upload whose claim row is not committed yet is safe), at most
 * {@code max-por-corrida} per run, oldest first. Runs after 03:50 Argentina and once at startup, so
 * a host that was off catches up (same template as the coordinate minimization job).
 *
 * <p>{@code app.evidencia.barrido.enabled=false} turns it off entirely: no listing, no deletion.
 * Deliberately not {@code @Transactional} (the N3 pitfall); the repository read has its own
 * read-only transaction. Logs and the actividad carry counts only, never keys.
 */
@Slf4j
@Component
public class EvidenciaHuerfanaBarridoJob {

    private final EvidenciaAlmacen almacen;
    private final ReclamoOrganizacionRepository reclamoRepository;
    private final ActividadService actividadService;
    private final Clock clock;
    private final boolean habilitado;
    private final long graciaDias;
    private final int maxPorCorrida;

    public EvidenciaHuerfanaBarridoJob(EvidenciaAlmacen almacen,
                                       ReclamoOrganizacionRepository reclamoRepository,
                                       ActividadService actividadService,
                                       Clock clock,
                                       @Value("${app.evidencia.barrido.enabled:true}") boolean habilitado,
                                       @Value("${app.evidencia.barrido.gracia-dias:7}") long graciaDias,
                                       @Value("${app.evidencia.barrido.max-por-corrida:500}") int maxPorCorrida) {
        this.almacen = almacen;
        this.reclamoRepository = reclamoRepository;
        this.actividadService = actividadService;
        this.clock = clock;
        this.habilitado = habilitado;
        this.graciaDias = Math.max(0, graciaDias);
        this.maxPorCorrida = Math.max(1, maxPorCorrida);
    }

    @Scheduled(cron = "${app.evidencia.barrido.cron:0 50 3 * * *}", zone = "America/Argentina/Buenos_Aires")
    public void programado() {
        ejecutar();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void alIniciar() {
        ejecutar();
    }

    /** Returns how many objects were deleted in this run. */
    public int ejecutar() {
        if (!habilitado || !almacen.disponible()) {
            return 0;
        }
        try {
            List<ObjetoAlmacenado> objetos = almacen.listar();
            // Loaded after the listing, so the referenced set is never older than what was listed.
            Set<String> referenciadas = new HashSet<>(reclamoRepository.findAllEvidenciaKeys());
            Instant corte = clock.instant().minus(Duration.ofDays(graciaDias));
            List<String> candidatas = objetos.stream()
                    .filter(o -> ClaveEvidenciaReclamo.PATRON.matcher(o.key()).matches())
                    .filter(o -> o.ultimaModificacion().isBefore(corte))
                    .filter(o -> !referenciadas.contains(o.key()))
                    .sorted(Comparator.comparing(ObjetoAlmacenado::ultimaModificacion)
                            .thenComparing(ObjetoAlmacenado::key))
                    .limit(maxPorCorrida)
                    .map(ObjetoAlmacenado::key)
                    .toList();
            ResultadoBorrado r = almacen.borrar(candidatas);
            if (r.fallidos() > 0) {
                log.warn("[evidencia] sweep: {} orphan objects could not be deleted", r.fallidos());
            }
            if (r.borrados() > 0) {
                log.info("[evidencia] sweep deleted {} orphaned claim evidence objects", r.borrados());
                actividadService.registrarAislado(ActividadService.Registro
                        .de(TipoActividad.EVIDENCIA_HUERFANA_BORRADA)
                        .sistema().entidad("RECLAMO_EVIDENCIA", null)
                        .detalle(r.borrados() + " archivos de evidencia huérfanos borrados"));
            }
            return r.borrados();
        } catch (RuntimeException e) {
            log.warn("[evidencia] orphan sweep failed: {}", e.getClass().getSimpleName());
            return 0;
        }
    }
}
