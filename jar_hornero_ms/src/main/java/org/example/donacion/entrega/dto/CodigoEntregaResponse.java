package org.example.donacion.entrega.dto;

import java.time.Instant;

/** Returned once from {@code POST /api/donaciones/{id}/entrega/codigo}. The plaintext code is
 * never persisted or returned again afterward. */
public record CodigoEntregaResponse(String codigo, Instant expiraEn) {}
