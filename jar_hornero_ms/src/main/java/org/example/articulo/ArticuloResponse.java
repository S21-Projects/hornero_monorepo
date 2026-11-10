package org.example.articulo;

public record ArticuloResponse(
        Long id,
        String nombre,
        String categoria,
        String unidad,
        boolean activo
) {}
