package org.example.necesidad.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.domain.PrioridadNecesidad;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CrearNecesidadRequest {

    @NotBlank(message = "La descripción es obligatoria")
    private String descripcion;

    @NotNull(message = "La prioridad es obligatoria")
    private PrioridadNecesidad prioridad;

    private LocalDate fechaVencimiento;

    @NotNull(message = "La organización es obligatoria")
    private Long organizacionId;

    // Feature catalogo-articulos, decision 6: categoria is derived from the selected articulos,
    // never hand-picked anymore — at least one articulo is required.
    @NotEmpty(message = "Se requiere al menos un articulo")
    private List<Long> articuloIds;
}
