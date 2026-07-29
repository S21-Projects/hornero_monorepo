package org.example.donacion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.donacion.dto.CreateDonacionRequest;
import org.example.donacion.dto.UpdateEstadoDonacionRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
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

@Tag(name = "Donaciones", description = "Donation management")
@RestController
@RequestMapping("/api/donaciones")
@RequiredArgsConstructor
public class DonacionController {

    private final DonacionService donacionService;

    @Operation(summary = "List donations, optionally filtered by organization")
    @GetMapping
    public List<DonacionResponse> getByOrganizacion(
            @RequestParam(required = false) Long organizacionId) {
        if (organizacionId != null) {
            return donacionService.findByOrganizacion(organizacionId);
        }
        return donacionService.findAll();
    }

    @Operation(summary = "Create a donation offer")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('DONANTE')")
    public DonacionResponse crear(@Valid @RequestBody CreateDonacionRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long donanteId = (Long) auth.getPrincipal();
        return donacionService.crear(request, donanteId);
    }

    @Operation(summary = "List my donations")
    @GetMapping("/mias")
    @PreAuthorize("hasRole('DONANTE')")
    public List<DonacionResponse> findMias() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long donanteId = (Long) auth.getPrincipal();
        return donacionService.findMias(donanteId);
    }

    @Operation(summary = "List donations received by my organization(s), optionally filtered by one")
    @GetMapping("/mi-organizacion")
    @PreAuthorize("hasRole('REFERENTE')")
    public List<DonacionResponse> findDeMiOrganizacion(
            @RequestParam(required = false) Long organizacionId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long referenteId = (Long) auth.getPrincipal();
        return donacionService.findDeMisOrganizaciones(referenteId, organizacionId);
    }

    @Operation(summary = "Get a donation by ID")
    @GetMapping("/{id}")
    public DonacionResponse findById(@PathVariable Long id) {
        return donacionService.findById(id);
    }

    @Operation(summary = "Update donation state")
    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasRole('REFERENTE')")
    public DonacionResponse actualizarEstado(@PathVariable Long id,
                                             @Valid @RequestBody UpdateEstadoDonacionRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long referenteId = (Long) auth.getPrincipal();
        return donacionService.actualizarEstado(id, request.getEstado(), referenteId);
    }

    @Operation(summary = "Delete a donation (only if OFRECIDA)")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('DONANTE')")
    public void eliminar(@PathVariable Long id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long donanteId = (Long) auth.getPrincipal();
        donacionService.eliminar(id, donanteId);
    }
}
