package org.example.donacion;

import lombok.extern.slf4j.Slf4j;
import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;

/**
 * N15/D12 (policy 1.4): the precise pickup point of a donation is needed only while it is in
 * flight. {@code app.datos.coordenadas-precisas-dias} (default 30) days after it reached a terminal
 * state (ENTREGADA, RECHAZADA, CANCELADA) its coordinates are rounded to two decimals. Runs daily
 * after midnight (Argentina) and once at startup, so a host that was off (the Raspberry Pi) catches
 * up. Batches commit independently; an optimistic conflict only skips that batch until tomorrow.
 *
 * <p>Deliberately not {@code @Transactional} (the N3 pitfall): each batch is a call to
 * {@link CoordenadasMinimizacionService}. Other coordinates in the system (organizations' public
 * locations) are not personal data and stay exact.
 */
@Slf4j
@Component
public class CoordenadasMinimizacionJob {

    private final DonacionRepository donacionRepository;
    private final CoordenadasMinimizacionService service;
    private final Clock clock;
    private final ActividadService actividadService;
    private final long dias;
    private final int tamanioLote;

    public CoordenadasMinimizacionJob(DonacionRepository donacionRepository,
                                      CoordenadasMinimizacionService service,
                                      Clock clock,
                                      ActividadService actividadService,
                                      @Value("${app.datos.coordenadas-precisas-dias:30}") long dias,
                                      @Value("${app.datos.coordenadas-lote:200}") int tamanioLote) {
        this.donacionRepository = donacionRepository;
        this.service = service;
        this.clock = clock;
        this.actividadService = actividadService;
        this.dias = dias;
        this.tamanioLote = Math.max(1, tamanioLote);
    }

    @Scheduled(cron = "${app.datos.coordenadas-cron:0 30 0 * * *}", zone = "America/Argentina/Buenos_Aires")
    public void programado() {
        ejecutar();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void alIniciar() {
        ejecutar();
    }

    /** Returns how many donations had their coordinates rounded in this run. */
    public int ejecutar() {
        Instant corte = clock.instant().minus(Duration.ofDays(dias));
        List<Long> ids = donacionRepository.findIdsConCoordenadasPrecisasTerminadasAntesDe(
                EnumSet.of(EstadoDonacion.ENTREGADA, EstadoDonacion.RECHAZADA, EstadoDonacion.CANCELADA),
                corte, Donacion.fechaLimiteFallback(corte, clock.getZone()));
        int total = 0;
        for (int i = 0; i < ids.size(); i += tamanioLote) {
            List<Long> lote = ids.subList(i, Math.min(ids.size(), i + tamanioLote));
            try {
                total += service.minimizar(lote);
            } catch (OptimisticLockingFailureException e) {
                log.info("[datos] a batch of {} donations changed concurrently, skipped until the next run", lote.size());
            } catch (RuntimeException e) {
                log.warn("[datos] coordinate minimization batch failed: {}", e.getClass().getSimpleName());
            }
        }
        if (total > 0) {
            log.info("[datos] coordinates of {} terminal donations rounded to 2 decimals", total);
            actividadService.registrar(ActividadService.Registro.de(TipoActividad.COORDENADAS_MINIMIZADAS)
                    .sistema().entidad("DONACION", null)
                    .detalle(total + " donaciones con coordenadas reducidas a 2 decimales"));
        }
        return total;
    }
}
