package org.example.asignacion.worker.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * One open candidate necesidad in the ronda input (worker contract v1). {@code codigoRadio},
 * {@code deficit} and {@code cumplimiento} are omitted (not sent as explicit {@code null}) when
 * absent, matching the golden fixture (AD-14's "absent vs zero" wire concern).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CandidatoEntradaV1 {
    private Long necesidadId;
    private Long organizacionId;
    private Double latitud;
    private Double longitud;
    private String codigoRadio;
    private Double deficit;
    private double urgencia;
    private int diasDesdeUltimaDonacion;
    private List<String> categoriasAceptadas;
    private List<String> categoriasPermitidas;
    private CumplimientoV1 cumplimiento; // null until slice 6b

    // Feature catalogo-articulos, work unit D: catalog articulo ids this necesidad selected,
    // mirroring the worker contract's additive `articuloIds` field.
    private List<Long> articuloIds;
}
