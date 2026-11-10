package org.example.donacion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.domain.EstadoDonacion;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OverrideEstadoRequest {

    @NotNull
    private EstadoDonacion estado;

    @NotBlank
    @Size(max = 500)
    private String motivo;
}
