package org.example.organizacion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.organizacion.dto.CrearOrganizacionRequest;
import org.example.organizacion.dto.OrganizacionResponse;
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
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('REFERENTE')")
    public OrganizacionResponse crear(@Valid @RequestBody CrearOrganizacionRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long userId = (Long) auth.getPrincipal();
        return organizacionService.crear(request, userId);
    }

    @Operation(summary = "Get the organization owned by the authenticated referente")
    @GetMapping("/mia")
    @PreAuthorize("hasRole('REFERENTE')")
    public OrganizacionResponse miOrganizacion() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long userId = (Long) auth.getPrincipal();
        return organizacionService.findByReferente(userId);
    }

    @Operation(summary = "List validated organizations (any authenticated user)")
    @GetMapping
    public List<OrganizacionResponse> listarValidadas() {
        return organizacionService.listarValidadas();
    }

    @Operation(summary = "List pending organizations (admin only)")
    @GetMapping("/pendientes")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public List<OrganizacionResponse> listarPendientes() {
        return organizacionService.listarPendientes();
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
        return organizacionService.rechazar(id);
    }
}
