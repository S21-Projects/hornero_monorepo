package org.example.reporte.dto;

/** A platform organizacion near a reported one, for the "already on Hornero" picker. */
public record OrganizacionCercanaResponse(
        Long id,
        String slug,
        String nombre,
        String direccion,
        int distanciaMetros) {
}
