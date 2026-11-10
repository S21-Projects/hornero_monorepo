package org.example.asignacion.worker.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Optional weight overrides (worker contract v1); any field left {@code null} uses the worker default. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PesosV1 {
    private Double deficit;
    private Double urgencia;
    private Double proximidad;
    private Double espera;
    private Double cumplimiento;
}
