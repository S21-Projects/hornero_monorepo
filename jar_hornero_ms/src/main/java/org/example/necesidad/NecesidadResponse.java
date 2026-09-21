package org.example.necesidad;

import org.example.domain.CategoriaAlimento;

import java.time.LocalDate;

public record NecesidadResponse(
        Long id,
        String descripcion,
        String prioridad,
        String estado,
        LocalDate fechaPublicacion,
        LocalDate fechaVencimiento,
        Long organizacionId,
        // Additive/nullable: null == unclassified (`specs/organizacion-acreditacion/spec.md`
        // "Level-Driven Food Category Caps").
        CategoriaAlimento categoria
) {}
