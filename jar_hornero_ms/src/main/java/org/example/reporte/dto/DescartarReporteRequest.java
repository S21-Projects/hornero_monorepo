package org.example.reporte.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DescartarReporteRequest(@NotBlank @Size(max = 1000) String nota) {
}
