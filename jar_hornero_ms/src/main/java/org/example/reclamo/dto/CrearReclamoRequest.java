package org.example.reclamo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.example.domain.RolReclamo;

import java.util.List;

/** {@code evidenciaKeys} come from the BFF upload route; the service checks they belong to this claimant. */
public record CrearReclamoRequest(
        @NotNull Long organizacionId,
        @NotNull RolReclamo rol,
        @NotBlank @Size(max = 40) @Pattern(regexp = "^[0-9+()\\-\\s]{6,40}$", message = "Teléfono inválido") String telefono,
        @Size(max = 1000) String mensaje,
        @NotEmpty @Size(max = 3) List<@NotBlank @Size(max = 255) String> evidenciaKeys) {
}
