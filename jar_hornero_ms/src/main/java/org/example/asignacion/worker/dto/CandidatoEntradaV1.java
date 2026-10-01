package org.example.asignacion.worker.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/** One open candidate necesidad in the ronda input (worker contract v1). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
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
}
