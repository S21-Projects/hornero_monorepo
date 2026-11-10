package org.example.donacion.entrega;

import org.example.idempotencia.Idempotente;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.donacion.entrega.dto.CodigoEntregaResponse;
import org.example.donacion.entrega.dto.EntregaEstadoResponse;
import org.example.donacion.entrega.dto.VerificarCodigoRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Mutual delivery-code confirmation (AD-6, spec `donacion-entrega-codigo`). Only the donante and
 * the referente of the donación may generate or verify — never an ADMINISTRADOR, whose only
 * state-changing path remains {@code DonacionController.overrideEstado}.
 */
@Tag(name = "Entrega", description = "Mutual delivery-code confirmation")
@RestController
@RequestMapping("/api/donaciones/{id}/entrega")
@RequiredArgsConstructor
public class EntregaController {

    private final EntregaService entregaService;

    @Operation(summary = "Generate this party's own delivery code (donante or referente)")
    @PostMapping("/codigo")
    @Idempotente
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('DONANTE', 'REFERENTE')")
    public CodigoEntregaResponse generar(@PathVariable Long id) {
        Long actorId = actorId();
        return entregaService.generar(id, actorId);
    }

    @Operation(summary = "Verify the counterpart's delivery code")
    @PostMapping("/verificar")
    @Idempotente
    @PreAuthorize("hasAnyRole('DONANTE', 'REFERENTE')")
    public EntregaEstadoResponse verificar(@PathVariable Long id, @Valid @RequestBody VerificarCodigoRequest request) {
        Long actorId = actorId();
        return entregaService.verificar(id, actorId, request.getCodigo());
    }

    @Operation(summary = "Both parties' delivery confirmation status")
    @GetMapping
    @PreAuthorize("hasAnyRole('DONANTE', 'REFERENTE')")
    public EntregaEstadoResponse estado(@PathVariable Long id) {
        Long actorId = actorId();
        return entregaService.estado(id, actorId);
    }

    private Long actorId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (Long) auth.getPrincipal();
    }
}
