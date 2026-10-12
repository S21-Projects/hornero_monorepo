package org.example.donacion;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Same null-safety and write-only-location contract as {@link DonacionResponse} — see its javadoc,
 * including {@code lineas} (feature catalogo-articulos, decision 4).
 *
 * <p>N12/D4: {@code estancada} is computed from {@code estadoDesde} and the configured windows (never
 * stored); {@code diasEnEstado} is the whole days spent in the current estado.
 */
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
        Instant overrideEn,
        String modalidad,
        String categoria,
        String fase,
        List<DonacionLineaResponse> lineas,
        boolean estancada,
        long diasEnEstado
) {}
