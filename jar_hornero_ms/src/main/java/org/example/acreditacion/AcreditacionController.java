package org.example.acreditacion;

import org.example.idempotencia.Idempotente;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.acreditacion.dto.AcreditacionResponse;
import org.example.acreditacion.dto.AuditarEvidenciaRequest;
import org.example.acreditacion.dto.CambiarNivelRequest;
import org.example.acreditacion.dto.CargarEvidenciaRequest;
import org.example.acreditacion.dto.EvidenciaResponse;
import org.example.acreditacion.dto.LegajoResponse;
import org.example.domain.EstadoEvidencia;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.TipoEvidencia;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * The six accreditation endpoints from design's "Interfaces / Contracts" table. Every route here
 * is {@code .authenticated()} at the {@code SecurityConfig} matcher level (AD-8) — the real
 * authority, since Spring evaluates matchers in declaration order. {@code @PreAuthorize} below is
 * defense in depth only.
 *
 * <p>D-01 (post-spec decision): {@code GET /{id}/legajo} is reachable by an ADMINISTRADOR or the
 * owning REFERENTE, not admin-only as design.md's original table states — the referente must be
 * able to export its own organization's dossier without depending on an admin.
 */
@Tag(name = "Acreditación", description = "Progressive accreditation ladder, evidence and legajo export")
@RestController
@RequestMapping("/api/organizaciones/{id}")
@RequiredArgsConstructor
public class AcreditacionController {

    private final AcreditacionService acreditacionService;
    private final OrganizacionRepository organizacionRepository;
    private final EvidenciaDescargaAuditor descargaAuditor;

    @Operation(summary = "Get the current accreditation level (admin or owning referente)")
    @GetMapping("/acreditacion")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR', 'REFERENTE')")
    public AcreditacionResponse acreditacion(@PathVariable Long id) {
        requireAdminOrOwningReferente(id);
        return acreditacionService.acreditacion(id);
    }

    @Operation(summary = "Submit evidence for a requisito (owning referente only)")
    @PostMapping("/acreditacion/evidencias")
    @Idempotente
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('REFERENTE')")
    public EvidenciaResponse cargarEvidencia(@PathVariable Long id,
                                              @Valid @RequestBody CargarEvidenciaRequest request) {
        // Threat Matrix "Evidence key smuggling", scoped by task 6.7 (Slice B): objectKey is now
        // accepted for FOTO/DOCUMENTO submissions, since the BFF's authenticated,
        // ownership-checked evidencia-files route exists to serve them. It stays rejected for
        // every other tipoEvidencia (DECLARACION today) — a text declaration has no business
        // carrying an object key, and the BFF's images.controller.ts deny-list on
        // `org-evidencia/` keys is untouched, so this is a controlled widening of the guard, not
        // its removal (see decisiones-posteriores.md and design.md's Slicing section).
        boolean requiresFile = request.tipoEvidencia() == TipoEvidencia.FOTO
                || request.tipoEvidencia() == TipoEvidencia.DOCUMENTO;
        if (!requiresFile && request.objectKey() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "objectKey is only accepted for FOTO/DOCUMENTO evidence");
        }

        Organizacion org = requireOwningReferente(id);
        var evidencia = acreditacionService.cargarEvidencia(org, request.requisito(), request.tipoEvidencia(),
                request.declaracion(), request.validoDesde(), request.validoHasta(), currentUserId(),
                request.objectKey());
        return EvidenciaResponse.from(evidencia);
    }

    @Operation(summary = "List the organizacion's evidence for the audit queue (admin only — D-02)")
    @GetMapping("/acreditacion/evidencias")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public List<EvidenciaResponse> evidencias(@PathVariable Long id,
                                               @RequestParam(required = false) EstadoEvidencia estado) {
        return acreditacionService.evidencias(id, estado);
    }

    @Operation(summary = "Approve a pending evidence row (admin only)")
    @PatchMapping("/acreditacion/evidencias/{evId}/aprobar")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public EvidenciaResponse aprobarEvidencia(@PathVariable Long id, @PathVariable Long evId) {
        return EvidenciaResponse.from(acreditacionService.aprobarEvidencia(evId, currentUserId()));
    }

    @Operation(summary = "Observe (flag) a pending evidence row with a reason (admin only)")
    @PatchMapping("/acreditacion/evidencias/{evId}/observar")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public EvidenciaResponse observarEvidencia(@PathVariable Long id, @PathVariable Long evId,
                                                @Valid @RequestBody AuditarEvidenciaRequest request) {
        return EvidenciaResponse.from(
                acreditacionService.observarEvidencia(evId, request.observacion(), currentUserId()));
    }

    @Operation(summary = "Raise or lower the accreditation level (admin only)")
    @PatchMapping("/acreditacion/nivel")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public AcreditacionResponse cambiarNivel(@PathVariable Long id, @Valid @RequestBody CambiarNivelRequest request) {
        acreditacionService.cambiarNivel(id, request.destino(), request.motivo(), currentUserId());
        return acreditacionService.acreditacion(id);
    }

    @Operation(summary = "Authorize reading an evidence file bound to an existing row (AD-12)")
    @GetMapping("/acreditacion/evidencias/archivo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR', 'REFERENTE')")
    public void archivoEvidencia(@PathVariable Long id, @RequestParam String objectKey) {
        requireAdminOrOwningReferente(id);
        acreditacionService.existeArchivoEvidencia(id, objectKey);
        // Recorded on authorization (the BFF streams the bytes right after this 204). Only admins:
        // an owning referente reading their own file is not an audit event.
        if (isAdmin()) {
            descargaAuditor.registrar(id, objectKey);
        }
    }

    @Operation(summary = "Export the full legajo (admin or owning referente — D-01)")
    @GetMapping("/legajo")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR', 'REFERENTE')")
    public LegajoResponse legajo(@PathVariable Long id) {
        requireAdminOrOwningReferente(id);
        return acreditacionService.legajo(id);
    }

    // --- ownership helpers ---

    private void requireAdminOrOwningReferente(Long orgId) {
        if (isAdmin()) {
            return;
        }
        requireOwningReferente(orgId);
    }

    private Organizacion requireOwningReferente(Long orgId) {
        Organizacion org = organizacionRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));
        Long userId = currentUserId();
        boolean isOwner = org.getReferente() != null && org.getReferente().getId().equals(userId);
        if (!isOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No sos el referente de esta organización");
        }
        return org;
    }

    private boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMINISTRADOR"));
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (Long) auth.getPrincipal();
    }
}
