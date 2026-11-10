package org.example.acreditacion.dto;

import jakarta.validation.constraints.Size;

/** Body for {@code PATCH .../observar} — {@code observacion} is required by the service layer. */
public record AuditarEvidenciaRequest(@Size(max = 1000) String observacion) {
}
