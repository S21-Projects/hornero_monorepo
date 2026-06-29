package org.example.donacion;

import java.time.LocalDate;

public record DonacionResponse(
        Long id,
        LocalDate fechaOferta,
        LocalDate fechaEntrega,
        String estado,
        String observaciones,
        String donanteName,
        Long necesidadId,
        Long organizacionId,
        String necesidadDescripcion,
        String organizacionNombre
) {}
