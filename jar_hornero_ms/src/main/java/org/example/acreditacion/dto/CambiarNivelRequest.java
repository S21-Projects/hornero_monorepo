package org.example.acreditacion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.example.domain.NivelAcreditacion;

public record CambiarNivelRequest(
        @NotNull NivelAcreditacion destino,
        @NotBlank @Size(max = 1000) String motivo) {
}
