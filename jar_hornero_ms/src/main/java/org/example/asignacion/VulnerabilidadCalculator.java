package org.example.asignacion;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.domain.EstadoNecesidad;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.PoblacionRadioRepository;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Live per-radio vulnerability of a ronda (spec ronda-vulnerabilidad-viva). The counts come from one
 * grouped query; the median and the formula live here as a pure function, so the spec scenario is a
 * plain unit test and the SQL stays portable.
 *
 * <pre>
 * hpc    = habitantes / comedores
 * median = percentile_cont(0.5) of hpc over the radios with comedores
 * v      = hpc / median * (1 + necesidades / comedores)
 * </pre>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VulnerabilidadCalculator {

    private static final List<String> ESTADOS_COMEDOR =
            List.of(EstadoOrganizacion.APROBADA.name(), EstadoOrganizacion.SIN_RECLAMAR.name());
    private static final List<String> ESTADOS_NECESIDAD_ABIERTA =
            List.of(EstadoNecesidad.ABIERTA.name(), EstadoNecesidad.EN_PROGRESO.name());

    private final PoblacionRadioRepository poblacionRadioRepository;

    /** Counts of one radio that has at least one comedor and a known population. */
    public record Zona(String codigoRadio, long habitantes, long comedores, long necesidades) {
    }

    /**
     * Vulnerability per radio from the current database, one grouped query. Radios absent from the
     * returned map get no value: the worker resolves them to NEUTRAL.
     */
    public Map<String, Double> calcular(LocalDate hoy) {
        List<Zona> zonas = poblacionRadioRepository
                .zonasConComedores(ESTADOS_COMEDOR, ESTADOS_NECESIDAD_ABIERTA, hoy).stream()
                .map(f -> new Zona((String) f[0], ((Number) f[1]).longValue(), ((Number) f[2]).longValue(),
                        ((Number) f[3]).longValue()))
                .toList();
        if (zonas.isEmpty()) {
            log.warn("poblacion_radio is empty or no comedor has a radio: every candidate gets a NEUTRAL "
                    + "deficit. Run `make importar-poblacion`.");
        }
        return vulnerabilidad(zonas);
    }

    /** Radios without population or without comedores take no part (they never enter the median). */
    static Map<String, Double> vulnerabilidad(List<Zona> zonas) {
        List<Zona> validas = zonas.stream().filter(z -> z.habitantes() > 0 && z.comedores() > 0).toList();
        if (validas.isEmpty()) {
            return Map.of();
        }
        double mediana = mediana(validas.stream().map(VulnerabilidadCalculator::habitantesPorComedor).toList());
        Map<String, Double> resultado = new HashMap<>();
        for (Zona z : validas) {
            resultado.put(z.codigoRadio(),
                    habitantesPorComedor(z) / mediana * (1.0 + (double) z.necesidades() / z.comedores()));
        }
        return resultado;
    }

    private static double habitantesPorComedor(Zona z) {
        return (double) z.habitantes() / z.comedores();
    }

    /** {@code percentile_cont(0.5)}: the middle value, or the mean of the two middle values. */
    private static double mediana(List<Double> valores) {
        List<Double> ordenados = new ArrayList<>(valores);
        ordenados.sort(Double::compare);
        int n = ordenados.size();
        return n % 2 == 1 ? ordenados.get(n / 2) : (ordenados.get(n / 2 - 1) + ordenados.get(n / 2)) / 2.0;
    }
}
