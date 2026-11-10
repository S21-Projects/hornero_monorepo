package org.example.articulo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.example.domain.CategoriaAlimento;
import org.example.domain.UnidadArticulo;

@Getter
@Setter
public class ActualizarArticuloRequest {

    @NotBlank
    private String nombre;

    @NotNull
    private CategoriaAlimento categoria;

    @NotNull
    private UnidadArticulo unidad;
}
