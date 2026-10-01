package org.example.asignacion.worker.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One matched (donación, necesidad) pair in the ronda response (worker contract v1). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AsignacionSalidaV1 {
    private Long donacionId;
    private Long necesidadId;
    private Long organizacionId;
    private double score;
    private double distanciaKm;
    private double costoOportunidad;
    private DesgloseV1 desglose;
    private String deficitFuente;
    private String codigoRadio;
}
