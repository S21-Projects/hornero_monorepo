package org.example.auditoria;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** On-demand verification of the accreditation event hash chain. Admin only; read-only. */
@Tag(name = "Auditoría", description = "Accreditation event hash chain")
@RestController
@RequestMapping("/api/auditoria/cadena")
@RequiredArgsConstructor
public class AuditoriaCadenaController {

    private final AuditoriaCadenaServicio servicio;

    @Operation(summary = "Verify the hash chain of the accreditation events now (admin only; never modifies data)")
    @GetMapping
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public VerificadorCadena.Resultado verificar() {
        return servicio.verificarSolicitada();
    }
}
