package org.example.donacion.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * One requested line of a {@link CreateDonacionRequest} (feature catalogo-articulos, decision 4):
 * an articulo id plus a {@code cantidad > 0}. Applies to both modalidades.
 */
@Getter
@Setter
@NoArgsConstructor
public class DonacionLineaRequest {

    @NotNull
    private Long articuloId;

    @NotNull
    @Positive
    private BigDecimal cantidad;
}
