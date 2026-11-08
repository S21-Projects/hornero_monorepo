package org.example.user;

import lombok.RequiredArgsConstructor;
import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.auth.RefreshTokenService;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final OrganizacionRepository organizacionRepository;
    private final RefreshTokenService refreshTokenService;
    private final ActividadService actividadService;

    /**
     * Admin listing, paged. Filters combine with AND: {@code tipo} keeps one user type, {@code activo=true}
     * keeps active accounts only, {@code q} is a case-insensitive "nombre or email contains". Any may be null.
     */
    public Page<UsuarioResponse> findAll(TipoUsuario tipo, Boolean activo, String q, Pageable pageable) {
        return usuarioRepository.buscarAdmin(
                        tipo != null,
                        claseDe(tipo),
                        Boolean.TRUE.equals(activo),
                        patronContiene(q),
                        pageable)
                .map(this::toResponse);
    }

    private static Class<? extends Usuario> claseDe(TipoUsuario tipo) {
        if (tipo == null) return Usuario.class;
        return switch (tipo) {
            case ADMINISTRADOR -> Administrador.class;
            case REFERENTE -> Referente.class;
            case DONANTE -> Donante.class;
        };
    }

    /** Lowercased LIKE pattern for "contains", with LIKE wildcards in the input escaped (escape char is '\\'). */
    private static String patronContiene(String q) {
        if (q == null || q.isBlank()) return "%";
        String escapado = q.trim().toLowerCase()
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escapado + "%";
    }

    @Transactional
    public UsuarioResponse toggleActivo(Long id, boolean activo) {
        return toggleActivo(id, activo, null);
    }

    /** {@code motivo} is optional; the actor is the admin in the security context (N10). */
    @Transactional
    public UsuarioResponse toggleActivo(Long id, boolean activo, String motivo) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario not found"));
        boolean antes = u.isActivo();
        u.setActivo(activo);
        Usuario saved = usuarioRepository.save(u);
        actividadService.registrar(ActividadService.Registro.de(
                        activo ? TipoActividad.USUARIO_ACTIVADO : TipoActividad.USUARIO_DESACTIVADO)
                .entidad("USUARIO", u.getId())
                .cambio(antes ? "activo" : "inactivo", activo ? "activo" : "inactivo")
                .motivo(motivo));

        if (!activo) {
            refreshTokenService.revokeAllFor(u.getId());
        }

        if (!activo && u instanceof Referente referente) {
            List<Organizacion> organizaciones = organizacionRepository.findByReferente_Id(referente.getId());
            organizaciones.forEach(org -> org.setReferente(null));
            organizacionRepository.saveAll(organizaciones);
        }

        return toResponse(saved);
    }

    /**
     * Admin-forced logout: revokes every refresh token of the user. An access token already issued
     * stays valid until it expires (15 minutes). The actor is the admin in the security context.
     */
    @Transactional
    public void revocarSesiones(Long id) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario not found"));
        refreshTokenService.revokeAllFor(u.getId());
        actividadService.registrar(ActividadService.Registro.de(TipoActividad.SESIONES_REVOCADAS)
                .entidad("USUARIO", u.getId())
                .detalle("sesiones revocadas por administrador"));
    }

    private UsuarioResponse toResponse(Usuario u) {
        return UsuarioResponse.de(u);
    }
}
