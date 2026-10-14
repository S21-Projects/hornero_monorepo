package org.example.evidencia;

import lombok.extern.slf4j.Slf4j;
import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.evidencia.EvidenciaAlmacen.ResultadoBorrado;
import org.example.reclamo.ClaveEvidenciaReclamo;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.Executor;

/**
 * Deletes a user's claim evidence objects once their anonymization has committed. Fires only
 * {@code AFTER_COMMIT} (and, as with the N13 mail listener, not outside a transaction), so a
 * rolled-back anonymization deletes nothing, and runs on a dedicated executor so the admin's
 * request never waits for the object store.
 *
 * <p>The objects are the keys the claims referenced plus any stray upload still under the user's
 * id (found with one listing). Everything is filtered through {@link ClaveEvidenciaReclamo}, so
 * only {@code reclamo-evidencia/{org}/{userId}/...} keys of this user are ever deleted. A failure
 * is logged and recorded and never reaches the caller; the nightly sweep retries.
 *
 * <p>Neither the log nor the actividad ever carries a key, an org id or a path: counts and
 * exception class names only.
 */
@Slf4j
@Component
public class EvidenciaBorradoListener {

    private final EvidenciaAlmacen almacen;
    private final ActividadService actividadService;
    private final Executor executor;

    public EvidenciaBorradoListener(EvidenciaAlmacen almacen, ActividadService actividadService,
                                    @Qualifier("evidenciaExecutor") Executor executor) {
        this.almacen = almacen;
        this.actividadService = actividadService;
        this.executor = executor;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alLiberarse(EvidenciaReclamoLiberadaEvento evento) {
        try {
            executor.execute(() -> borrar(evento));
        } catch (RuntimeException e) {
            // A saturated/shut-down pool must not turn a committed anonymization into an error.
            log.warn("[evidencia] could not queue the evidence deletion: {}", e.getClass().getSimpleName());
        }
    }

    private void borrar(EvidenciaReclamoLiberadaEvento evento) {
        Long usuarioId = evento.usuarioId();
        try {
            Set<String> aBorrar = new LinkedHashSet<>();
            evento.keys().stream().filter(k -> esDe(k, usuarioId)).forEach(aBorrar::add);
            almacen.listar().stream().map(EvidenciaAlmacen.ObjetoAlmacenado::key)
                    .filter(k -> esDe(k, usuarioId)).forEach(aBorrar::add);
            ResultadoBorrado r = almacen.borrar(aBorrar);
            registrar(usuarioId, r);
        } catch (RuntimeException e) {
            log.warn("[evidencia] evidence deletion failed: {}", e.getClass().getSimpleName());
            actividadService.registrarAislado(base(usuarioId).fallo()
                    .detalle("borrado de evidencia fallido (" + e.getClass().getSimpleName()
                            + "); lo reintenta el barrido"));
        }
    }

    private void registrar(Long usuarioId, ResultadoBorrado r) {
        if (r.fallidos() > 0) {
            log.warn("[evidencia] {} evidence objects could not be deleted, left for the sweep", r.fallidos());
            actividadService.registrarAislado(base(usuarioId).fallo()
                    .detalle(r.borrados() + " archivos borrados, " + r.fallidos() + " pendientes para el barrido"));
        } else if (r.borrados() > 0) {
            log.info("[evidencia] {} claim evidence objects deleted", r.borrados());
            actividadService.registrarAislado(base(usuarioId)
                    .detalle(r.borrados() + " archivos de evidencia de reclamos borrados"));
        } else {
            log.debug("[evidencia] no claim evidence objects to delete");
        }
    }

    private static ActividadService.Registro base(Long usuarioId) {
        return ActividadService.Registro.de(TipoActividad.EVIDENCIA_RECLAMO_BORRADA)
                .sistema().entidad("USUARIO", usuarioId);
    }

    private static boolean esDe(String key, Long usuarioId) {
        return ClaveEvidenciaReclamo.referenteId(key).filter(usuarioId::equals).isPresent();
    }
}
