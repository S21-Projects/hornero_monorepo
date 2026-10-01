package org.example.asignacion.worker.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/** 200 response body of {@code POST /v1/ronda} (`go_algorithms_worker/contract/ronda-v1.md`). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SalidaRondaV1 {
    private int version;
    private List<AsignacionSalidaV1> asignaciones;
    private List<Long> sinAsignar;
    private double scoreTotal;
    private PesosV1 pesos;
    private ParametrosV1 parametros;
}
