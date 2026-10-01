package org.example.asignacion.dto;

import java.time.LocalDate;

/** Current pool size for {@code GET /api/rondas/fondo} — before triggering a ronda. */
public record RondaFondoResponse(int pendientes, LocalDate masAntiguaDesde) {}
