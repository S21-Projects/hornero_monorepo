package org.example.articulo;

import org.example.idempotencia.Idempotente;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.articulo.dto.ActualizarArticuloRequest;
import org.example.articulo.dto.CrearArticuloRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Feature catalogo-articulos, work unit A (C2/C3): public read, ADMINISTRADOR-only writes.
 * Mirrors the matcher-ordering discipline documented in {@code SecurityConfig} for
 * {@code /api/rondas/**} — see {@code SecurityConfig}'s {@code /api/articulos/**} matchers.
 */
@Tag(name = "Articulos", description = "Donation/necesidad catalog item management")
@RestController
@RequestMapping("/api/articulos")
@RequiredArgsConstructor
public class ArticuloController {

    private final ArticuloService articuloService;

    @Operation(summary = "List catalog items (active only by default)")
    @GetMapping
    public List<ArticuloResponse> listar(
            @RequestParam(required = false, defaultValue = "false") boolean incluirInactivos) {
        return articuloService.listar(incluirInactivos);
    }

    @Operation(summary = "Create a catalog item")
    @PostMapping
    @Idempotente
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public ArticuloResponse crear(@Valid @RequestBody CrearArticuloRequest request) {
        return articuloService.crear(request);
    }

    @Operation(summary = "Edit a catalog item's nombre/categoria/unidad")
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public ArticuloResponse actualizar(@PathVariable Long id, @Valid @RequestBody ActualizarArticuloRequest request) {
        return articuloService.actualizar(id, request);
    }

    @Operation(summary = "Deactivate a catalog item (soft delete, never a hard delete)")
    @PatchMapping("/{id}/desactivar")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public ArticuloResponse desactivar(@PathVariable Long id) {
        return articuloService.desactivar(id);
    }

    @Operation(summary = "Reactivate a previously deactivated catalog item")
    @PatchMapping("/{id}/reactivar")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public ArticuloResponse reactivar(@PathVariable Long id) {
        return articuloService.reactivar(id);
    }
}
