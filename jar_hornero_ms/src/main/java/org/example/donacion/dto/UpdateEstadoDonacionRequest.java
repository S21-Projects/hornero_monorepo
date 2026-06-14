package org.example.donacion.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.domain.EstadoDonacion;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateEstadoDonacionRequest {

    @NotNull
    private EstadoDonacion estado;
}
