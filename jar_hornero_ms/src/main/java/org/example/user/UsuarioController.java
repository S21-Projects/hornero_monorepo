package org.example.user;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.common.PageData;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.example.idempotencia.Idempotente;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpStatus;

@Tag(name = "Usuarios", description = "User management")
@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioService usuarioService;
    private final UsuarioAnonimizacionService anonimizacionService;

    @GetMapping
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public PageData<UsuarioResponse> getAll(
            @RequestParam(required = false) TipoUsuario tipo,
            @RequestParam(required = false) Boolean activo,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "id") Pageable pageable) {
        return PageData.from(usuarioService.findAll(tipo, activo, q, pageable));
    }

    @PatchMapping("/{id}/activo")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public UsuarioResponse toggleActivo(@PathVariable Long id,
                                        @Valid @RequestBody UpdateActivoRequest request) {
        return usuarioService.toggleActivo(id, request.getActivo(), request.getMotivo());
    }

    /** Forces logout: revokes every refresh token of the user. Audited with the admin as actor. */
    @PostMapping("/{id}/sesiones/revocar")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revocarSesiones(@PathVariable Long id) {
        usuarioService.revocarSesiones(id);
    }

    /** N15/D12: right to erasure. Irreversible; see {@link UsuarioAnonimizacionService}. */
    @PostMapping("/{id}/anonimizar")
    @Idempotente
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public UsuarioResponse anonimizar(@PathVariable Long id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return anonimizacionService.anonimizar(id, (Long) auth.getPrincipal());
    }
}
