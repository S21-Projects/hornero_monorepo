package org.example.donacion;

import java.time.Instant;
import java.time.LocalDate;

/**
 * {@code necesidadId}/{@code organizacionId} are {@code null} only for an unassigned
 * {@code FONDO_COMUN} donación waiting in the pool (slice 5b). {@code latitud}/{@code longitud}
 * are deliberately never included here — the donante's pickup point is write-only
 * (`specs/donacion-fondo-comun/spec.md` "Location and Categoria Required for Pool Donations").
 */
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
        String organizacionNombre,
        Long donanteId,
        Instant confirmadaDonanteEn,
        Instant confirmadaReferenteEn,
        String modalidad,
        String categoria,
        String fase
) {}
