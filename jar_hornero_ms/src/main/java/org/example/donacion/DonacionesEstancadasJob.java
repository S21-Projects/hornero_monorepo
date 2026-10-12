package org.example.donacion;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.domain.AsignacionRepository;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

/**
 * N12/D4: daily housekeeping of donations nobody answered. Reassignment is out of scope.
 * <ul>
 *   <li>{@code DIRECTA} {@code OFRECIDA} with no referente answer past the offer window: auto
 *       {@code CANCELADA} (actor SISTEMA).</li>
 *   <li>Pool {@code Asignacion} {@code PROPUESTA} unanswered past the proposal window: treated as a
 *       rejection through the same return-to-pool path as a referente rejection.</li>
 *   <li>{@code ACEPTADA}/{@code EN_CAMINO}/{@code PENDIENTE_CONFIRMACION} are never cancelled here:
 *       they are flagged "estancada" for the admin ({@link EstancamientoDonacion}).</li>
 * </ul>
 * Runs just after midnight (Argentina) and once at startup, so a host that was off at midnight (the
 * Raspberry Pi) catches up. Each donation is processed in its own transaction (a
 * {@link DonacionService} call, so the proxy applies and the row lock is taken); a concurrent user
 * action wins cleanly and an optimistic conflict only skips that row.
 *
 * <p>This class is deliberately not {@code @Transactional}: a method of the job calling another
 * annotated method of itself would bypass the proxy (the N3 pitfall).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DonacionesEstancadasJob {

    private final DonacionRepository donacionRepository;
    private final AsignacionRepository asignacionRepository;
    private final DonacionService donacionService;
    private final Clock clock;
    private final ActividadService actividadService;
    private final VentanasDonacion ventanas;

    public record Resumen(int canceladas, int propuestasVencidas, int conflictos) {
    }

    @Scheduled(cron = "${app.donaciones.estancadas-cron:0 15 0 * * *}", zone = "America/Argentina/Buenos_Aires")
    public void programado() {
        ejecutar();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void alIniciar() {
        ejecutar();
    }

    public Resumen ejecutar() {
        Instant ahora = clock.instant();
        int canceladas = 0;
        int propuestasVencidas = 0;
        int conflictos = 0;

        Instant corteOferta = ahora.minus(ventanas.ofertaSinRespuesta());
        List<Long> ofertas = donacionRepository.findIdsOfrecidasDirectasDesde(
                corteOferta, Donacion.fechaLimiteFallback(corteOferta, clock.getZone()));
        for (Long id : ofertas) {
            try {
                if (donacionService.cancelarOfertaSinRespuesta(id, corteOferta)) {
                    canceladas++;
                }
            } catch (OptimisticLockingFailureException e) {
                conflictos++;
                log.info("[donaciones] donacion {} changed concurrently, skipped (offer expiry)", id);
            } catch (RuntimeException e) {
                conflictos++;
                log.warn("[donaciones] donacion {} could not be expired: {}", id, e.getClass().getSimpleName());
            }
        }

        Instant cortePropuesta = ahora.minus(ventanas.propuestaSinRespuesta());
        for (Long id : asignacionRepository.findDonacionIdsConPropuestaAnteriorA(cortePropuesta)) {
            try {
                if (donacionService.expirarPropuesta(id, cortePropuesta)) {
                    propuestasVencidas++;
                }
            } catch (OptimisticLockingFailureException e) {
                conflictos++;
                log.info("[donaciones] donacion {} changed concurrently, skipped (proposal expiry)", id);
            } catch (RuntimeException e) {
                conflictos++;
                log.warn("[donaciones] donacion {} proposal could not be expired: {}", id, e.getClass().getSimpleName());
            }
        }

        Resumen resumen = new Resumen(canceladas, propuestasVencidas, conflictos);
        if (canceladas + propuestasVencidas + conflictos > 0) {
            log.info("[donaciones] stale donations run: {} offers cancelled, {} proposals expired, {} skipped",
                    canceladas, propuestasVencidas, conflictos);
            actividadService.registrar(ActividadService.Registro.de(TipoActividad.DONACIONES_ESTANCADAS_PROCESADAS)
                    .sistema().entidad("DONACION", null)
                    .detalle(canceladas + " ofertas canceladas, " + propuestasVencidas
                            + " propuestas vencidas, " + conflictos + " omitidas"));
        }
        return resumen;
    }
}
