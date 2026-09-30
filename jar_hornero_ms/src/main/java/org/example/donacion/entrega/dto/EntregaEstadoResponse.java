package org.example.donacion.entrega.dto;

import java.time.Instant;

/** Both parties' confirmation status for a donación's delivery, polled by the confirmation screen. */
public record EntregaEstadoResponse(String estado, Instant confirmadaDonanteEn, Instant confirmadaReferenteEn) {}
