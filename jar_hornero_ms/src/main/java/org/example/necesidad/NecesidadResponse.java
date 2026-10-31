package org.example.necesidad;

import org.example.domain.CategoriaAlimento;

import java.time.LocalDate;
import java.util.List;

public record NecesidadResponse(
        Long id,
        String descripcion,
        String prioridad,
        String estado,
        LocalDate fechaPublicacion,
        LocalDate fechaVencimiento,
        Long organizacionId,
        // Lets list/detail views show the owning organization without a second lookup of the whole catalog.
        String organizacionNombre,
        // Additive/nullable: null == unclassified, only for necesidades predating this feature
        // (`specs/organizacion-acreditacion/spec.md` "Level-Driven Food Category Caps"). Every new
        // necesidad derives it from `articulos` (feature catalogo-articulos, decision 6).
        CategoriaAlimento categoria,
        List<NecesidadArticuloResponse> articulos
) {}
