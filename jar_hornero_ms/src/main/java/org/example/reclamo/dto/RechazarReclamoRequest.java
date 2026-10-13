package org.example.reclamo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RechazarReclamoRequest(@NotBlank @Size(max = 1000) String motivo) {
}
