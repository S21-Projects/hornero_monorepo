package org.example.necesidad.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.domain.EstadoNecesidad;
import org.example.domain.PrioridadNecesidad;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ActualizarNecesidadRequest {

    private String descripcion;
    private PrioridadNecesidad prioridad;
    private EstadoNecesidad estado;
    private LocalDate fechaVencimiento;
}
