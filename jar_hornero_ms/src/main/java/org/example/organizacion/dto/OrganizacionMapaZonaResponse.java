package org.example.organizacion.dto;

import java.util.List;

/**
 * Pins inside one map viewport. {@code truncated} is true when more organizaciones matched than
 * {@code OrganizacionService#MAX_PINES_ZONA}, so the client should ask for a smaller area.
 */
public record OrganizacionMapaZonaResponse(List<OrganizacionMapaResponse> pins, boolean truncated) {}
