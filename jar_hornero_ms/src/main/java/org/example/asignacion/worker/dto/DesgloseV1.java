package org.example.asignacion.worker.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Per-criterion normalized [0,1] terms behind {@code score} (worker contract v1). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DesgloseV1 {
    private double deficit;
    private double urgencia;
    private double proximidad;
    private double espera;
    private Double cumplimiento; // null until slice 6b
}
