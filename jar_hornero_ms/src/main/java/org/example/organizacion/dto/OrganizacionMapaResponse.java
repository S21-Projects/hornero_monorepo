package org.example.organizacion.dto;

import org.example.domain.EstadoOrganizacion;
import org.example.domain.OrigenOrganizacion;
import org.example.domain.TipoOrganizacion;

/**
 * Minimal projection for the public map: no contact data, no pending snapshot.
 * {@code necesidadesAbiertas} counts the organizacion's necesidades that are still uncovered
 * (ABIERTA or EN_PROGRESO, not past their fechaVencimiento); see {@code OrganizacionRepository#findMapa}.
 */
public record OrganizacionMapaResponse(
        Long id,
        String slug,
        String nombre,
        TipoOrganizacion tipo,
        EstadoOrganizacion estado,
        OrigenOrganizacion origen,
        Double latitud,
        Double longitud,
        long necesidadesAbiertas) {}
