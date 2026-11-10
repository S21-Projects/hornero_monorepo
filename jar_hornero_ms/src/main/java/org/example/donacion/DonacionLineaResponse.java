package org.example.donacion;

import java.math.BigDecimal;

public record DonacionLineaResponse(
        Long articuloId,
        String articuloNombre,
        String unidad,
        BigDecimal cantidad
) {}
