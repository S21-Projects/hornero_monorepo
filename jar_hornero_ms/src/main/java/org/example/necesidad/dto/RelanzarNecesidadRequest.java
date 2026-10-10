package org.example.necesidad.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/** D2/N4: relaunching an expired necesidad requires a new expiry date (strictly after today). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RelanzarNecesidadRequest {

    @NotNull(message = "La fecha de vencimiento es obligatoria")
    private LocalDate fechaVencimiento;
}
