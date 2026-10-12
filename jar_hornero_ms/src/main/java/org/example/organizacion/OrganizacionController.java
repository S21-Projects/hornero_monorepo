package org.example.organizacion;

import org.example.idempotencia.Idempotente;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.common.PageData;
import org.example.organizacion.dto.ActualizarInfoPublicaRequest;
import org.example.organizacion.dto.ActualizarOrganizacionRequest;
import org.example.organizacion.dto.AsignarReferenteRequest;
import org.example.organizacion.dto.CrearOrganizacionRequest;
import org.example.organizacion.dto.OrganizacionMapaResponse;
import org.example.organizacion.dto.OrganizacionResponse;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.lang.Nullable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Organizaciones", description = "Organization management")
@RestController
@RequestMapping("/api/organizaciones")
@RequiredArgsConstructor
public class OrganizacionController {

    private final OrganizacionService organizacionService;

    @Operation(summary = "Propose a new organization (referente only)")
    @PostMapping
    @Idempotente
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('REFERENTE')")
    public OrganizacionResponse crear(@Valid @RequestBody CrearOrganizacionRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long userId = (Long) auth.getPrincipal();
        return organizacionService.crear(request, userId);
    }

    @Operation(summary = "Get the organizations owned by the authenticated referente")
    @GetMapping("/mia")
    @PreAuthorize("hasRole('REFERENTE')")
    public List<OrganizacionResponse> misOrganizaciones() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long userId = (Long) auth.getPrincipal();
        return organizacionService.listarPorReferente(userId);
    }

    @Operation(summary = "List validated organizations (any authenticated user)")
    @GetMapping
    public PageData<OrganizacionResponse> listarValidadas(
            @PageableDefault(size = 20, sort = "id") Pageable pageable) {
        return PageData.from(organizacionService.listarValidadas(pageable));
    }

    @Operation(summary = "Lightweight list for the public map: approved and unclaimed organizations with coordinates")
    @GetMapping("/mapa")
    public ResponseEntity<List<OrganizacionMapaResponse>> mapa() {
        return ResponseEntity.ok()
                .cacheControl(org.springframework.http.CacheControl.maxAge(java.time.Duration.ofMinutes(5)).cachePublic())
                .body(organizacionService.listarMapa());
    }

    @Operation(summary = "List pending organizations (admin only)")
    @GetMapping("/pendientes")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public PageData<OrganizacionResponse> listarPendientes(
            @PageableDefault(size = 20, sort = "id") Pageable pageable) {
        return PageData.from(organizacionService.listarPendientes(pageable));
    }

    @Operation(summary = "List all organizations, any estado/referente (admin only)")
    @GetMapping("/todas")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public List<OrganizacionResponse> listarTodas() {
        return organizacionService.listarTodas();
    }

    @Operation(summary = "Get organization by slug (access policy enforced by service)")
    @GetMapping("/{slug}")
    public ResponseEntity<OrganizacionResponse> findBySlug(@PathVariable String slug, @Nullable Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            return ResponseEntity.ok(organizacionService.findBySlugPublic(slug));
        }
        Long userId = (Long) auth.getPrincipal();
        String role = auth.getAuthorities().iterator().next().getAuthority();
        return ResponseEntity.ok(organizacionService.findBySlug(slug, userId, role));
    }

    @Operation(summary = "Validate an organization (admin only)")
    @PatchMapping("/{id}/validar")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public OrganizacionResponse validar(@PathVariable Long id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long userId = (Long) auth.getPrincipal();
        return organizacionService.validar(id, userId);
    }

    @Operation(summary = "Reject an organization (admin only)")
    @PatchMapping("/{id}/rechazar")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public OrganizacionResponse rechazar(@PathVariable Long id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long userId = (Long) auth.getPrincipal();
        return organizacionService.rechazar(id, userId);
    }

    @Operation(summary = "Update an organization (referente owner only)")
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('REFERENTE')")
    public ResponseEntity<OrganizacionResponse> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarOrganizacionRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long userId = (Long) auth.getPrincipal();
        return ResponseEntity.ok(organizacionService.actualizar(id, request, userId));
    }

    @Operation(summary = "Reassign or unassign an organization's referente (admin only)")
    @PatchMapping("/{id}/referente")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public OrganizacionResponse asignarReferente(@PathVariable Long id,
                                                 @Valid @RequestBody AsignarReferenteRequest request) {
        return organizacionService.asignarReferente(id, request);
    }

    @Operation(summary = "Directly edit info pública fields for any organization, live immediately (admin only)")
    @PatchMapping("/{id}/info-publica")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public OrganizacionResponse actualizarInfoPublica(@PathVariable Long id,
                                                       @Valid @RequestBody ActualizarInfoPublicaRequest request) {
        return organizacionService.actualizarInfoPublica(id, request);
    }

    @Operation(summary = "Approve a referente's pending info pública submission (admin only)")
    @PatchMapping("/{id}/info-publica/aprobar")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public OrganizacionResponse aprobarInfoPublica(@PathVariable Long id) {
        return organizacionService.aprobarInfoPublica(id);
    }

    @Operation(summary = "Reject a referente's pending info pública submission (admin only)")
    @PatchMapping("/{id}/info-publica/rechazar")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public OrganizacionResponse rechazarInfoPublica(@PathVariable Long id) {
        return organizacionService.rechazarInfoPublica(id);
    }
}
