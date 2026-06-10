package org.example.necesidad;

import java.time.LocalDate;

public record NecesidadResponse(
        Long id,
        String descripcion,
        String prioridad,
        String estado,
        LocalDate fechaPublicacion,
        LocalDate fechaVencimiento,
        Long organizacionId
) {}
