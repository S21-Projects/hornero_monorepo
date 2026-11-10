package org.example.necesidad;

public record NecesidadArticuloResponse(
        Long id,
        String nombre,
        String unidad,
        String categoria
) {}
