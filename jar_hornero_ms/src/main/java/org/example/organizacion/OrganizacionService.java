package org.example.organizacion;

import lombok.RequiredArgsConstructor;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.organizacion.dto.CrearOrganizacionRequest;
import org.example.organizacion.dto.OrganizacionResponse;
import org.example.user.Administrador;
import org.example.user.Referente;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrganizacionService {

    private final OrganizacionRepository organizacionRepository;
    private final UsuarioRepository usuarioRepository;

    public OrganizacionResponse crear(CrearOrganizacionRequest request, Long referenteUserId) {
        Usuario usuario = usuarioRepository.findById(referenteUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));

        if (!(usuario instanceof Referente referente)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo los referentes pueden proponer organizaciones");
        }

        Organizacion organizacion = new Organizacion();
        organizacion.setNombre(request.getNombre());
        organizacion.setTipo(request.getTipo());
        organizacion.setDescripcion(request.getDescripcion());
        organizacion.setDireccion(request.getDireccion());
        organizacion.setLatitud(request.getLatitud());
        organizacion.setLongitud(request.getLongitud());
        organizacion.setValidada(false);
        organizacion.setReferente(referente);

        Organizacion saved = organizacionRepository.save(organizacion);
        return toResponse(saved);
    }

    public List<OrganizacionResponse> listarValidadas() {
        return organizacionRepository.findByValidada(true)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<OrganizacionResponse> listarPendientes() {
        return organizacionRepository.findByValidada(false)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public OrganizacionResponse validar(Long orgId, Long adminUserId) {
        Organizacion organizacion = organizacionRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        if (Boolean.TRUE.equals(organizacion.getValidada())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La organización ya fue validada");
        }

        Usuario usuario = usuarioRepository.findById(adminUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));

        if (!(usuario instanceof Administrador administrador)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo los administradores pueden validar organizaciones");
        }

        organizacion.setValidada(true);
        organizacion.setValidadoPor(administrador);

        Organizacion saved = organizacionRepository.save(organizacion);
        return toResponse(saved);
    }

    public OrganizacionResponse findByReferente(Long referenteId) {
        return organizacionRepository.findByReferente_Id(referenteId)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No se encontró organización para este referente"));
    }

    public OrganizacionResponse toResponse(Organizacion organizacion) {
        String referenteNombre = organizacion.getReferente() != null ? organizacion.getReferente().getNombre() : null;
        String referenteEmail = organizacion.getReferente() != null ? organizacion.getReferente().getEmail() : null;
        String validadoPorNombre = organizacion.getValidadoPor() != null ? organizacion.getValidadoPor().getNombre() : null;

        return new OrganizacionResponse(
                organizacion.getId(),
                organizacion.getNombre(),
                organizacion.getTipo(),
                organizacion.getDescripcion(),
                organizacion.getDireccion(),
                organizacion.getLatitud(),
                organizacion.getLongitud(),
                organizacion.getValidada(),
                referenteNombre,
                referenteEmail,
                validadoPorNombre
        );
    }
}
