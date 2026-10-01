package org.example.donacion.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.domain.ModalidadDonacion;

import java.util.List;

/**
 * {@code necesidadId} is no longer {@code @NotNull} at the DTO level (slice 5b,
 * `specs/donacion-fondo-comun/spec.md`): a {@code FONDO_COMUN} donación is created without one.
 * The modalidad-dependent required/forbidden field cross-validation
 * (necesidadId XOR lineas+coordinates) lives in {@code DonacionService.crear}, not here, to
 * keep a single source of truth with the rest of the creation rules.
 *
 * <p>Feature catalogo-articulos, decision 4/5: {@code categoria} is no longer a client-supplied
 * field — it is always derived from {@code lineas} (both modalidades), so there is no path left
 * for a client to submit a categoria that contradicts its lines.
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

    /** Required for both modalidades (decision 4): at least one line, articulo id + cantidad > 0. */
    private List<DonacionLineaRequest> lineas;

    /** Donante-marked pickup point, required and DIRECTA-forbidden, for FONDO_COMUN only. */
    private Double latitud;

    private Double longitud;
}
