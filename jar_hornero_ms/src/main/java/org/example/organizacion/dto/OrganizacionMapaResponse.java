package org.example.organizacion.dto;

import org.example.domain.EstadoOrganizacion;
import org.example.domain.OrigenOrganizacion;
import org.example.domain.TipoOrganizacion;

/** Minimal projection for the public map: no contact data, no pending snapshot. */
public record OrganizacionMapaResponse(
        Long id,
        String slug,
        String nombre,
        TipoOrganizacion tipo,
        EstadoOrganizacion estado,
        OrigenOrganizacion origen,
        Double latitud,
        Double longitud) {}
