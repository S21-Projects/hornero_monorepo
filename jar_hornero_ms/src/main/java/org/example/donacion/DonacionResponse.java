package org.example.donacion;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * {@code necesidadId}/{@code organizacionId} are {@code null} only for an unassigned
 * {@code FONDO_COMUN} donación waiting in the pool (slice 5b). {@code latitud}/{@code longitud}
 * are deliberately never included here — the donante's pickup point is write-only
 * (`specs/donacion-fondo-comun/spec.md` "Location and Categoria Required for Pool Donations").
 *
 * <p>{@code lineas} (feature catalogo-articulos, decision 4): the donación's articulo/cantidad
 * lines, from which {@code categoria} is always derived (decision 5) — never hand-entered.
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
        String fase,
        List<DonacionLineaResponse> lineas
) {}
