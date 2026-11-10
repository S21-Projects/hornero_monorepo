package org.example.asignacion.worker.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Raw delivery/failure counts for one candidate organización (worker contract v1, AD-11, slice 6b). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CumplimientoV1 {
    private int entregadas;
    private int fallidas;
}
