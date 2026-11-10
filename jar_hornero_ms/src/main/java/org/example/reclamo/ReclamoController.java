package org.example.reclamo;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.common.PageData;
import org.example.idempotencia.Idempotente;
import org.example.reclamo.dto.CrearReclamoRequest;
import org.example.reclamo.dto.RechazarReclamoRequest;
import org.example.reclamo.dto.ReclamoResponse;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Claim flow for unclaimed organizaciones. Everything here is authenticated at the
 * {@code SecurityConfig} matcher (the real authority); {@code @PreAuthorize} is the per-verb role gate.
 */
@Tag(name = "Reclamos", description = "Claims on unclaimed (ReNaCoM) organizaciones")
@RestController
@RequestMapping("/api/reclamos")
@RequiredArgsConstructor
public class ReclamoController {

    private final ReclamoService reclamoService;

    @Operation(summary = "Claim an unclaimed organization (referente only)")
    @PostMapping
    @Idempotente
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('REFERENTE')")
    public ReclamoResponse crear(@Valid @RequestBody CrearReclamoRequest request) {
        return reclamoService.crear(request, currentUserId());
    }

    @Operation(summary = "List the authenticated referente's own claims")
    @GetMapping("/mios")
    @PreAuthorize("hasRole('REFERENTE')")
    public List<ReclamoResponse> mios() {
        return reclamoService.listarMios(currentUserId());
    }

    @Operation(summary = "List pending claims, oldest first (admin only)")
    @GetMapping("/pendientes")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public PageData<ReclamoResponse> pendientes(
            @PageableDefault(size = 20, sort = "creadoEn") Pageable pageable) {
        return PageData.from(reclamoService.listarPendientes(pageable));
    }

    @Operation(summary = "Pre-flight before uploading claim evidence: can the caller claim this organization? (referente only)")
    @GetMapping("/disponibilidad")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('REFERENTE')")
    public void disponibilidad(@RequestParam Long organizacionId) {
        reclamoService.verificarReclamable(organizacionId, currentUserId());
    }

    @Operation(summary = "Authorize reading a claim evidence file (admin or the claimant)")
    @GetMapping("/archivo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR', 'REFERENTE')")
    public void archivo(@RequestParam Long organizacionId, @RequestParam Long solicitanteId,
                        @RequestParam String objectKey) {
        reclamoService.verificarArchivo(organizacionId, solicitanteId, objectKey, currentUserId(), isAdmin());
    }

    @Operation(summary = "Claim detail (admin, or the claimant)")
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR', 'REFERENTE')")
    public ReclamoResponse detalle(@PathVariable Long id) {
        return reclamoService.detalle(id, currentUserId(), isAdmin());
    }

    @Operation(summary = "Approve a claim and assign the organization to the claimant (admin only)")
    @PatchMapping("/{id}/aprobar")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public ReclamoResponse aprobar(@PathVariable Long id) {
        return reclamoService.aprobar(id, currentUserId());
    }

    @Operation(summary = "Reject a claim with a mandatory reason (admin only)")
    @PatchMapping("/{id}/rechazar")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public ReclamoResponse rechazar(@PathVariable Long id, @Valid @RequestBody RechazarReclamoRequest request) {
        return reclamoService.rechazar(id, request.motivo(), currentUserId());
    }

    private static Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (Long) auth.getPrincipal();
    }

    private static boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMINISTRADOR"));
    }
}
