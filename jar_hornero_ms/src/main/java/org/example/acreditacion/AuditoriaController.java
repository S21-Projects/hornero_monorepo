package org.example.acreditacion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.example.acreditacion.dto.ColaAuditoriaFiltro;
import org.example.acreditacion.dto.EvidenciaEnColaResponse;
import org.example.acreditacion.dto.TabCola;
import org.example.common.PageData;
import org.example.domain.NivelAcreditacion;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEvidencia;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * AD-8 (tesis-core-features, slice 4a), `specs/auditoria-cola-global/spec.md`: the cross-org audit
 * queue, deliberately on its own {@code /api/auditoria/**} root rather than under
 * {@code /api/organizaciones/**}, which has a {@code GET permitAll} matcher in
 * {@code SecurityConfig} — a new root avoids relying on matcher ordering. Still ADMINISTRADOR-only
 * both at the {@code SecurityConfig} matcher (the real authority, evaluated in declaration order)
 * and here via {@code @PreAuthorize} as defense in depth.
 */
@Tag(name = "Auditoría", description = "Cross-organizacion audit queue")
@RestController
@RequestMapping("/api/auditoria")
@RequiredArgsConstructor
public class AuditoriaController {

    private final AcreditacionService acreditacionService;

    @Operation(summary = "List the cross-org audit queue (admin only — AD-8)")
    @GetMapping("/evidencias")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public PageData<EvidenciaEnColaResponse> evidencias(
            @RequestParam(defaultValue = "PENDIENTES") TabCola tab,
            @RequestParam(required = false) NivelAcreditacion nivel,
            @RequestParam(required = false) RequisitoAcreditacion requisito,
            @RequestParam(required = false) TipoEvidencia tipoEvidencia,
            @PageableDefault(size = 20, sort = "cargadoEn", direction = Sort.Direction.ASC) Pageable pageable) {
        ColaAuditoriaFiltro filtro = new ColaAuditoriaFiltro(tab, nivel, requisito, tipoEvidencia);
        return PageData.from(acreditacionService.colaAuditoria(filtro, pageable));
    }
}
