package org.example.asignacion.dto;

/**
 * One assignment of a ronda for {@code GET /api/rondas/{id}/asignaciones} (admin): the existing
 * {@link AsignacionResponse} row (organización, score, terms, weights) plus the donación and
 * necesidad context it does not carry. {@code donacionDescripcion} is a short summary of the
 * donación's lines ("Arroz x5, Leche x2"), or null when it has none.
 */
public record AsignacionRondaResponse(
        AsignacionResponse asignacion,
        Long donacionId,
        String donacionDescripcion,
        String necesidadDescripcion
) {}
