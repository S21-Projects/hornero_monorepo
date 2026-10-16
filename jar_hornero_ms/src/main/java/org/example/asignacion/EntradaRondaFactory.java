package org.example.asignacion;

import lombok.RequiredArgsConstructor;
import org.example.acreditacion.AcreditacionService;
import org.example.asignacion.worker.dto.CandidatoEntradaV1;
import org.example.asignacion.worker.dto.CumplimientoV1;
import org.example.asignacion.worker.dto.DonacionEntradaV1;
import org.example.asignacion.worker.dto.EntradaRondaV1;
import org.example.domain.CategoriaAlimento;
import org.example.domain.Donacion;
import org.example.domain.Necesidad;
import org.example.domain.Organizacion;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

/**
 * Assembles the worker contract v1 request shape from the pool, the already-filtered candidates,
 * per-organización {@code diasDesdeUltimaDonacion}, and per-donación exclusions (AD-9).
 */
@Component
@RequiredArgsConstructor
public class EntradaRondaFactory {

    private static final long ESPERA_MAXIMA_DIAS_DEFECTO = 90;

    private final AcreditacionService acreditacionService;
    private final CumplimientoCalculator cumplimientoCalculator;
    private final VulnerabilidadCalculator vulnerabilidadCalculator;

    public EntradaRondaV1 crear(List<Donacion> pool,
                                 List<Necesidad> candidatas,
                                 Map<Long, Long> diasDesdeUltimaDonacionPorOrganizacion,
                                 Map<Long, List<Long>> organizacionesExcluidasPorDonacion,
                                 LocalDate hoy) {
        // One grouped query for the whole ronda (AD-11, 6b) — never per-candidate, to avoid an
        // N+1 pattern against `donacion`.
        Map<Long, CumplimientoV1> cumplimientoPorOrganizacion = cumplimientoCalculator.calcular();
        // Same for the live per-radio vulnerability (rondas-datos-vivos): one grouped query per ronda.
        Map<String, Double> vulnerabilidadPorRadio = vulnerabilidadCalculator.calcular(hoy);

        EntradaRondaV1 entrada = new EntradaRondaV1();
        entrada.setVersion(1);
        entrada.setDonaciones(pool.stream().map(d -> donacionEntrada(d, organizacionesExcluidasPorDonacion, hoy)).toList());
        entrada.setCandidatos(candidatas.stream()
                .map(n -> candidatoEntrada(n, diasDesdeUltimaDonacionPorOrganizacion, cumplimientoPorOrganizacion,
                        vulnerabilidadPorRadio, hoy))
                .toList());
        return entrada;
    }

    private DonacionEntradaV1 donacionEntrada(Donacion d, Map<Long, List<Long>> exclusionesPorDonacion, LocalDate hoy) {
        DonacionEntradaV1 e = new DonacionEntradaV1();
        e.setId(d.getId());
        e.setLatitud(d.getLatitud());
        e.setLongitud(d.getLongitud());
        e.setCategoria(d.getCategoria() != null ? d.getCategoria().name() : null);
        // Clamped at 0: a date stamped later than `hoy` (e.g. UTC vs Buenos Aires near midnight) must
        // never become a negative count, which the worker rejects with 400.
        e.setDiasEnFondo(d.getFechaOferta() != null
                ? (int) Math.max(0, ChronoUnit.DAYS.between(d.getFechaOferta(), hoy)) : 0);
        e.setOrganizacionesExcluidas(exclusionesPorDonacion.getOrDefault(d.getId(), List.of()));
        e.setArticuloIds(d.getLineas().stream().map(linea -> linea.getArticulo().getId()).toList());
        return e;
    }

    private CandidatoEntradaV1 candidatoEntrada(Necesidad n, Map<Long, Long> diasDesdeUltimaDonacionPorOrganizacion,
                                                 Map<Long, CumplimientoV1> cumplimientoPorOrganizacion,
                                                 Map<String, Double> vulnerabilidadPorRadio, LocalDate hoy) {
        Organizacion organizacion = n.getOrganizacion();
        CandidatoEntradaV1 c = new CandidatoEntradaV1();
        c.setNecesidadId(n.getId());
        c.setOrganizacionId(organizacion.getId());
        c.setLatitud(organizacion.getLatitud());
        c.setLongitud(organizacion.getLongitud());
        // The radio is always sent when known; the deficit only when computed. Omitting it makes the
        // worker answer NEUTRAL 1.0 (deficitFuente), see AD-5.
        c.setCodigoRadio(organizacion.getCodigoRadio());
        c.setDeficit(organizacion.getCodigoRadio() != null ? vulnerabilidadPorRadio.get(organizacion.getCodigoRadio()) : null);
        c.setUrgencia(UrgenciaCalculator.calcular(n.getPrioridad(), n.getFechaVencimiento(), hoy));
        c.setDiasDesdeUltimaDonacion(
                (int) Math.max(0, diasDesdeUltimaDonacionPorOrganizacion.getOrDefault(organizacion.getId(), ESPERA_MAXIMA_DIAS_DEFECTO)));
        c.setCategoriasAceptadas(n.getCategoria() != null ? List.of(n.getCategoria().name()) : List.of());
        c.setCategoriasPermitidas(acreditacionService.categoriasPermitidas(organizacion.getNivel())
                .stream().map(CategoriaAlimento::name).toList());
        c.setArticuloIds(n.getArticulos().stream().map(na -> na.getArticulo().getId()).toList());
        // null when the organización has no resolved (ENTREGADA/RECHAZADA) history yet — the
        // worker resolves that absence to the ronda's neutral prior (AD-11).
        c.setCumplimiento(cumplimientoPorOrganizacion.get(organizacion.getId()));
        return c;
    }
}
