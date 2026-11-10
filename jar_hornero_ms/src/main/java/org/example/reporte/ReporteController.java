package org.example.reporte;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.common.PageData;
import org.example.idempotencia.Idempotente;
import org.example.reporte.dto.CrearReporteRequest;
import org.example.reporte.dto.DescartarReporteRequest;
import org.example.reporte.dto.OrganizacionCercanaResponse;
import org.example.reporte.dto.ReporteResponse;
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
 * Report flow for unclaimed organizaciones. Authenticated at the {@code SecurityConfig} matcher (the
 * real authority); {@code @PreAuthorize} is the per-verb role gate (any role submits, admin resolves).
 */
@Tag(name = "Reportes", description = "Reports on unclaimed (ReNaCoM) organizaciones")
@RestController
@RequestMapping("/api/reportes")
@RequiredArgsConstructor
public class ReporteController {

    private final ReporteService reporteService;

    @Operation(summary = "Report an unclaimed organization (any authenticated user)")
    @PostMapping
    @Idempotente
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("isAuthenticated()")
    public ReporteResponse crear(@Valid @RequestBody CrearReporteRequest request) {
        return reporteService.crear(request, currentUserId());
    }

    @Operation(summary = "Hornero organizations within 500 m of an unclaimed one, for the duplicate picker")
    @GetMapping("/cercanas")
    @PreAuthorize("isAuthenticated()")
    public List<OrganizacionCercanaResponse> cercanas(@RequestParam Long organizacionId) {
        return reporteService.cercanas(organizacionId);
    }

    @Operation(summary = "List pending reports, oldest first (admin only)")
    @GetMapping("/pendientes")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public PageData<ReporteResponse> pendientes(
            @PageableDefault(size = 20, sort = "creadoEn") Pageable pageable) {
        return PageData.from(reporteService.listarPendientes(pageable));
    }

    @Operation(summary = "Report detail (admin only)")
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public ReporteResponse detalle(@PathVariable Long id) {
        return reporteService.detalle(id);
    }

    @Operation(summary = "Mark the organization inactive and confirm its pending reports (admin only)")
    @PatchMapping("/{id}/marcar-inactiva")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public ReporteResponse marcarInactiva(@PathVariable Long id) {
        return reporteService.marcarInactiva(id, currentUserId());
    }

    @Operation(summary = "Discard a report with a mandatory note (admin only)")
    @PatchMapping("/{id}/descartar")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public ReporteResponse descartar(@PathVariable Long id, @Valid @RequestBody DescartarReporteRequest request) {
        return reporteService.descartar(id, request.nota(), currentUserId());
    }

    private static Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (Long) auth.getPrincipal();
    }
}
