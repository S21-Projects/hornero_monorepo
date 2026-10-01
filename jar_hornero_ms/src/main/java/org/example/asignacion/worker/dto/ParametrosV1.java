package org.example.asignacion.worker.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Optional solver parameter overrides (worker contract v1); {@code null} fields use worker defaults. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ParametrosV1 {
    private Double distanciaMediaKm;
    private Double distanciaMaximaKm;
    private Double esperaMaximaDias;
    private Double deficitMaximo;
    private Double penalizacionNoAsignar;
    private Double radioResolucionKm;
    private Integer cumplimientoPseudoObs;
}
