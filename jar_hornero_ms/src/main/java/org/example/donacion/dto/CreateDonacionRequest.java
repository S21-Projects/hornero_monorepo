package org.example.donacion.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.domain.CategoriaAlimento;
import org.example.domain.ModalidadDonacion;

/**
 * {@code necesidadId} is no longer {@code @NotNull} at the DTO level (slice 5b,
 * `specs/donacion-fondo-comun/spec.md`): a {@code FONDO_COMUN} donación is created without one.
 * The modalidad-dependent required/forbidden field cross-validation
 * (necesidadId XOR categoria+coordinates) lives in {@code DonacionService.crear}, not here, to
 * keep a single source of truth with the rest of the creation rules.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateDonacionRequest {

    /** {@code null} is coalesced to {@link ModalidadDonacion#DIRECTA} for backward compatibility. */
    private ModalidadDonacion modalidad;

    private Long necesidadId;

    @Size(max = 1000)
    private String observaciones;

    /** Required, DIRECTA-forbidden, for FONDO_COMUN only. */
    private CategoriaAlimento categoria;

    /** Donante-marked pickup point, required and DIRECTA-forbidden, for FONDO_COMUN only. */
    private Double latitud;

    private Double longitud;
}
