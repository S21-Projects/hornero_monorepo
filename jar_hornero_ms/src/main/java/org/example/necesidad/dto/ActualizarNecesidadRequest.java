package org.example.necesidad.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.domain.EstadoNecesidad;
import org.example.domain.PrioridadNecesidad;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ActualizarNecesidadRequest {

    private String descripcion;
    private PrioridadNecesidad prioridad;
    private EstadoNecesidad estado;
    private LocalDate fechaVencimiento;

    // Feature catalogo-articulos, decision 6: null means "leave articulos unchanged" (same
    // convention as every other field on this partial-update DTO); a non-null list must be
    // non-empty at the service level — a necesidad can never be left with zero articulos.
    private List<Long> articuloIds;
}
