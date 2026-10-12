package org.example.donacion;

import org.example.idempotencia.Idempotente;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.common.PageData;
import org.example.domain.EstadoDonacion;
import org.example.donacion.dto.CreateDonacionRequest;
import org.example.donacion.dto.DecisionDonacionRequest;
import org.example.donacion.dto.OverrideEstadoRequest;
import org.example.donacion.dto.UpdateEstadoDonacionRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
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
    public PageData<DonacionResponse> getByOrganizacion(
            @RequestParam(required = false) Long organizacionId,
            @PageableDefault(size = 20, sort = {"fechaOferta", "id"}, direction = Sort.Direction.DESC) Pageable pageable) {
        if (organizacionId != null) {
            return PageData.from(donacionService.findByOrganizacion(organizacionId, pageable));
        }
        return PageData.from(donacionService.findAll(pageable));
    }

    @Operation(summary = "Create a donation offer")
    @PostMapping
    @Idempotente
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
    public PageData<DonacionResponse> findMias(
            @PageableDefault(size = 20, sort = {"fechaOferta", "id"}, direction = Sort.Direction.DESC) Pageable pageable) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long donanteId = (Long) auth.getPrincipal();
        return PageData.from(donacionService.findMias(donanteId, pageable));
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

    @Operation(summary = "List active (non-terminal) donations for admin oversight, paginated, searchable and filterable by stale (estancadas=true)")
    @GetMapping("/activas")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public PageData<DonacionActivaResponse> findActivas(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) EstadoDonacion estado,
            @RequestParam(required = false, defaultValue = "false") boolean estancadas,
            @PageableDefault(size = 20, sort = {"fechaOferta", "id"}, direction = Sort.Direction.DESC) Pageable pageable) {
        return PageData.from(donacionService.findActivas(q, estado, estancadas, pageable));
    }

    @Operation(summary = "Get a donation by ID")
    @GetMapping("/{id}")
    public DonacionResponse findById(@PathVariable Long id) {
        return donacionService.findById(id);
    }

    @Operation(summary = "Referente decides to accept or reject a donation offer")
    @PatchMapping("/{id}/decision")
    @PreAuthorize("hasRole('REFERENTE')")
    public DonacionResponse decidir(@PathVariable Long id,
                                     @Valid @RequestBody DecisionDonacionRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long referenteId = (Long) auth.getPrincipal();
        return donacionService.decidir(id, request.getEstado(), referenteId);
    }

    @Operation(summary = "Update donation state (donante logistics: EN_CAMINO, CANCELADA)")
    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasRole('DONANTE')")
    public DonacionResponse actualizarEstado(@PathVariable Long id,
                                             @Valid @RequestBody UpdateEstadoDonacionRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long donanteId = (Long) auth.getPrincipal();
        return donacionService.actualizarEstado(id, request.getEstado(), donanteId);
    }

    @Operation(summary = "Admin override: force a non-terminal donation into any state, with audit trail")
    @PatchMapping("/{id}/estado-admin")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public DonacionResponse overrideEstado(@PathVariable Long id,
                                            @Valid @RequestBody OverrideEstadoRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long adminId = (Long) auth.getPrincipal();
        return donacionService.overrideEstado(id, request.getEstado(), request.getMotivo(), adminId);
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
