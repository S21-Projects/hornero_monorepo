package org.example.evidencia;

import lombok.extern.slf4j.Slf4j;
import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.domain.EstadoEvidencia;
import org.example.domain.OrganizacionEvidencia;
import org.example.domain.OrganizacionEvidenciaRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Retention of accreditation evidence files. Deletes from the bucket the file of every evidence row
 * that is {@code REEMPLAZADA}, or whose validity ended more than {@code meses} months ago, and sets
 * {@code archivo_eliminado_at}. The row, its {@code objectKey} and its events are kept; downloads
 * of a deleted file answer 410.
 *
 * <p><b>Disabled by default.</b> Two independent guards: this job returns immediately unless
 * {@code app.evidencia.retencion.habilitada} is true, and {@link ArchivoAcreditacionAlmacenConfig}
 * builds a no-op store (no S3 client) under the same condition. It does not run at startup, only on
 * its cron, and handles at most {@code max-por-corrida} rows per run, oldest first.
 *
 * <p>One file is deleted, then its row is marked, then one {@code EVIDENCIA_ACREDITACION_ARCHIVO_BORRADO}
 * activity row is written. A file whose deletion fails is left unmarked and retried on the next
 * run; deleting an already-absent object succeeds, so a crash between delete and mark is harmless.
 * Not {@code @Transactional}: each step has its own short transaction (the N3 pitfall). Logs and
 * activity rows carry counts and ids, never object keys.
 */
@Slf4j
@Component
public class EvidenciaAcreditacionRetencionJob {

    private final ArchivoAcreditacionAlmacen almacen;
    private final OrganizacionEvidenciaRepository repository;
    private final ActividadService actividadService;
    private final Clock clock;
    private final boolean habilitada;
    private final int meses;
    private final int maxPorCorrida;

    public EvidenciaAcreditacionRetencionJob(
            ArchivoAcreditacionAlmacen almacen,
            OrganizacionEvidenciaRepository repository,
            ActividadService actividadService,
            Clock clock,
            @Value("${app.evidencia.retencion.habilitada:false}") boolean habilitada,
            @Value("${app.evidencia.retencion.meses:12}") int meses,
            @Value("${app.evidencia.retencion.max-por-corrida:100}") int maxPorCorrida) {
        this.almacen = almacen;
        this.repository = repository;
        this.actividadService = actividadService;
        this.clock = clock;
        this.habilitada = habilitada;
        this.meses = Math.max(1, meses);
        this.maxPorCorrida = Math.max(1, maxPorCorrida);
    }

    @Scheduled(cron = "${app.evidencia.retencion.cron:0 30 4 * * *}", zone = "America/Argentina/Buenos_Aires")
    public void programado() {
        ejecutar();
    }

    /** Returns how many files were deleted in this run. */
    public int ejecutar() {
        if (!habilitada || !almacen.disponible()) {
            return 0;
        }
        try {
            LocalDate corte = LocalDate.now(clock).minusMonths(meses);
            List<OrganizacionEvidencia> candidatas = repository.buscarParaRetencion(
                    EstadoEvidencia.REEMPLAZADA, corte, PageRequest.of(0, maxPorCorrida));
            int borrados = 0;
            int fallidos = 0;
            for (OrganizacionEvidencia evidencia : candidatas) {
                if (borrar(evidencia)) {
                    borrados++;
                } else {
                    fallidos++;
                }
            }
            log.info("[evidencia] retention run: {} files deleted, {} failed, {} candidates (batch limit {}, "
                    + "expiry cutoff {})", borrados, fallidos, candidatas.size(), maxPorCorrida, corte);
            return borrados;
        } catch (RuntimeException e) {
            log.warn("[evidencia] accreditation retention failed: {}", e.getClass().getSimpleName());
            return 0;
        }
    }

    private boolean borrar(OrganizacionEvidencia evidencia) {
        try {
            almacen.borrar(evidencia.getObjectKey());
            evidencia.setArchivoEliminadoAt(Instant.now(clock));
            repository.save(evidencia);
            actividadService.registrarAislado(ActividadService.Registro
                    .de(TipoActividad.EVIDENCIA_ACREDITACION_ARCHIVO_BORRADO)
                    .sistema().entidad("EVIDENCIA", evidencia.getId())
                    .detalle("Archivo de evidencia borrado por retencion (organizacion "
                            + evidencia.getOrganizacion().getId() + ", estado " + evidencia.getEstado() + ")"));
            return true;
        } catch (RuntimeException e) {
            log.warn("[evidencia] retention could not delete evidence {}: {}", evidencia.getId(),
                    e.getClass().getSimpleName());
            return false;
        }
    }
}
