package org.example.asignacion;

import org.example.asignacion.VulnerabilidadCalculator.Zona;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/** Pure formula of the live ronda vulnerability (spec ronda-vulnerabilidad-viva). */
class VulnerabilidadCalculatorTest {

    @Test
    void deficitFollowsTheFormula() {
        // hpc: R1 = 3000/2 = 1500, R2 = 1000, R3 = 500 -> median 1000.
        Map<String, Double> resultado = VulnerabilidadCalculator.vulnerabilidad(List.of(
                new Zona("R1", 3000, 2, 1),
                new Zona("R2", 1000, 1, 0),
                new Zona("R3", 500, 1, 0)));

        // (3000/2)/1000 * (1 + 1/2) = 2.25
        assertThat(resultado.get("R1")).isCloseTo(2.25, within(1e-9));
        assertThat(resultado.get("R2")).isCloseTo(1.0, within(1e-9));
        assertThat(resultado.get("R3")).isCloseTo(0.5, within(1e-9));
    }

    @Test
    void evenCountMedianAveragesTheTwoMiddleValues() {
        // hpc 1000 and 3000 -> median 2000.
        Map<String, Double> resultado = VulnerabilidadCalculator.vulnerabilidad(List.of(
                new Zona("A", 1000, 1, 0),
                new Zona("B", 3000, 1, 2)));

        assertThat(resultado.get("A")).isCloseTo(0.5, within(1e-9));
        // 3000/2000 * (1 + 2/1) = 4.5
        assertThat(resultado.get("B")).isCloseTo(4.5, within(1e-9));
    }

    @Test
    void radiosWithoutPopulationOrComedoresAreOmitted() {
        Map<String, Double> resultado = VulnerabilidadCalculator.vulnerabilidad(List.of(
                new Zona("OK", 1000, 1, 0),
                new Zona("SIN_POBLACION", 0, 1, 0),
                new Zona("SIN_COMEDORES", 1000, 0, 0)));

        assertThat(resultado).containsOnlyKeys("OK");
    }
}
