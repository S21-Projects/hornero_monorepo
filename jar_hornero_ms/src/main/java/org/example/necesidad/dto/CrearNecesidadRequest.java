package org.example.necesidad.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.domain.CategoriaAlimento;
import org.example.domain.PrioridadNecesidad;

import java.time.LocalDate;

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

    // Additive/nullable: null == unclassified, unaffected by the level cap
    // (`specs/organizacion-acreditacion/spec.md` "Level-Driven Food Category Caps").
    private CategoriaAlimento categoria;
}
