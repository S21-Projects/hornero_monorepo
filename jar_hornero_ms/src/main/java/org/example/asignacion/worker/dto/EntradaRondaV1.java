package org.example.asignacion.worker.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/** Request body of {@code POST /v1/ronda} (`go_algorithms_worker/contract/ronda-v1.md`). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EntradaRondaV1 {
    private int version;
    private List<DonacionEntradaV1> donaciones;
    private List<CandidatoEntradaV1> candidatos;
    private PesosV1 pesos;
    private ParametrosV1 parametros;
}
