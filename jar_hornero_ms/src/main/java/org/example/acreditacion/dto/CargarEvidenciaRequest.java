package org.example.acreditacion.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEvidencia;

import java.time.LocalDate;

/**
 * {@code objectKey} MUST be accepted as a field (Slice B needs it) but is rejected with {@code 400}
 * if non-null in Slice A — the MS cannot record a reference to an evidence file the BFF has no
 * authenticated route to serve yet (design's "Slicing" section, Threat Matrix "Evidence key
 * smuggling" row).
 */
public record CargarEvidenciaRequest(
        @NotNull RequisitoAcreditacion requisito,
        @NotNull TipoEvidencia tipoEvidencia,
        @Size(max = 2000) String declaracion,
        String objectKey,
        LocalDate validoDesde,
        LocalDate validoHasta) {
}
