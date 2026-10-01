package org.example.asignacion.worker.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/** One unassigned pool donación in the ronda input (worker contract v1). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DonacionEntradaV1 {
    private Long id;
    private Double latitud;
    private Double longitud;
    private String categoria;
    private int diasEnFondo;
    private List<Long> organizacionesExcluidas;
}
