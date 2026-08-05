package org.example.donacion;

import java.time.Instant;
import java.time.LocalDate;

public record DonacionActivaResponse(
        Long id,
        LocalDate fechaOferta,
        LocalDate fechaEntrega,
        String estado,
        String observaciones,
        Long donanteId,
        String donanteNombre,
        Long necesidadId,
        String necesidadDescripcion,
        Long organizacionId,
        String organizacionNombre,
        Instant confirmadaDonanteEn,
        Instant confirmadaReferenteEn,
        String overrideMotivo,
        Long overrideAdminId,
        Instant overrideEn
) {}
