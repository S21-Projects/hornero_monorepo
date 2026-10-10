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

    public Page<UsuarioResponse> findAll(Pageable pageable) {
        return usuarioRepository.findAll(pageable)
                .map(this::toResponse);
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

    private UsuarioResponse toResponse(Usuario u) {
        String tipo = u instanceof Donante ? "DONANTE"
                : u instanceof Referente ? "REFERENTE"
                : "ADMINISTRADOR";
        return new UsuarioResponse(u.getId(), u.getNombre(), u.getEmail(), tipo, u.isActivo());
    }
}
