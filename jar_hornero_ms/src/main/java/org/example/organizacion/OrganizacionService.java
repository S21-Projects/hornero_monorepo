package org.example.organizacion;

import lombok.RequiredArgsConstructor;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.organizacion.dto.ActualizarOrganizacionRequest;
import org.example.organizacion.dto.CrearOrganizacionRequest;
import org.example.organizacion.dto.OrganizacionResponse;
import org.example.user.Administrador;
import org.example.user.Referente;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrganizacionService {

    private final OrganizacionRepository organizacionRepository;
    private final UsuarioRepository usuarioRepository;

    @Transactional
    public OrganizacionResponse crear(CrearOrganizacionRequest request, Long referenteUserId) {
        Usuario usuario = usuarioRepository.findById(referenteUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));

        if (!(usuario instanceof Referente referente)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo los referentes pueden proponer organizaciones");
        }

        Organizacion organizacion = new Organizacion();
        organizacion.setNombre(request.getNombre());
        organizacion.setSlug(generateSlug(request.getNombre()));
        organizacion.setTipo(request.getTipo());
        organizacion.setDescripcion(request.getDescripcion());
        organizacion.setDireccion(request.getDireccion());
        organizacion.setLatitud(request.getLatitud());
        organizacion.setLongitud(request.getLongitud());
        organizacion.setEstado(EstadoOrganizacion.PENDIENTE);
        organizacion.setReferente(referente);

        Organizacion saved = organizacionRepository.save(organizacion);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<OrganizacionResponse> listarValidadas() {
        return organizacionRepository.findByEstado(EstadoOrganizacion.APROBADA)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrganizacionResponse> listarPendientes() {
        return organizacionRepository.findByEstado(EstadoOrganizacion.PENDIENTE)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public OrganizacionResponse validar(Long orgId, Long adminUserId) {
        Organizacion organizacion = organizacionRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        if (EstadoOrganizacion.APROBADA.equals(organizacion.getEstado())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La organización ya fue validada");
        }

        Usuario usuario = usuarioRepository.findById(adminUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));

        if (!(usuario instanceof Administrador administrador)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo los administradores pueden validar organizaciones");
        }

        organizacion.setEstado(EstadoOrganizacion.APROBADA);
        organizacion.setValidada(true);
        organizacion.setValidadoPor(administrador);

        Organizacion saved = organizacionRepository.save(organizacion);
        return toResponse(saved);
    }

    @Transactional
    public OrganizacionResponse rechazar(Long orgId) {
        Organizacion organizacion = organizacionRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        if (!EstadoOrganizacion.PENDIENTE.equals(organizacion.getEstado())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Solo se pueden rechazar organizaciones en estado PENDIENTE");
        }

        organizacion.setEstado(EstadoOrganizacion.RECHAZADA);

        Organizacion saved = organizacionRepository.save(organizacion);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public OrganizacionResponse findBySlugPublic(String slug) {
        return organizacionRepository.findBySlug(slug)
                .filter(o -> EstadoOrganizacion.APROBADA.equals(o.getEstado()))
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));
    }

    @Transactional(readOnly = true)
    public OrganizacionResponse findByReferente(Long referenteId) {
        return organizacionRepository.findByReferente_Id(referenteId)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No se encontró organización para este referente"));
    }

    @Transactional(readOnly = true)
    public OrganizacionResponse findBySlug(String slug, Long requestingUserId, String requestingRole) {
        Organizacion org = organizacionRepository.findBySlug(slug)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        if (EstadoOrganizacion.APROBADA.equals(org.getEstado())) {
            return toResponse(org);
        }

        boolean isAdmin = "ROLE_ADMINISTRADOR".equals(requestingRole);
        boolean isOwner = org.getReferente() != null && org.getReferente().getId().equals(requestingUserId);

        if (isAdmin || isOwner) {
            return toResponse(org);
        }

        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Acceso denegado");
    }

    @Transactional
    public OrganizacionResponse actualizar(Long orgId, ActualizarOrganizacionRequest request, Long referenteUserId) {
        Organizacion organizacion = organizacionRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        if (organizacion.getReferente() == null || !organizacion.getReferente().getId().equals(referenteUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tenés permiso para editar esta organización");
        }

        if (request.getNombre() != null) organizacion.setNombre(request.getNombre());
        if (request.getTipo() != null) organizacion.setTipo(request.getTipo());
        if (request.getDescripcion() != null) organizacion.setDescripcion(request.getDescripcion());
        if (request.getDireccion() != null) organizacion.setDireccion(request.getDireccion());
        if (request.getLatitud() != null) organizacion.setLatitud(request.getLatitud());
        if (request.getLongitud() != null) organizacion.setLongitud(request.getLongitud());

        Organizacion saved = organizacionRepository.save(organizacion);
        return toResponse(saved);
    }

    public OrganizacionResponse toResponse(Organizacion organizacion) {
        String referenteNombre = organizacion.getReferente() != null ? organizacion.getReferente().getNombre() : null;
        String referenteEmail = organizacion.getReferente() != null ? organizacion.getReferente().getEmail() : null;
        String validadoPorNombre = organizacion.getValidadoPor() != null ? organizacion.getValidadoPor().getNombre() : null;

        return new OrganizacionResponse(
                organizacion.getId(),
                organizacion.getNombre(),
                organizacion.getSlug(),
                organizacion.getTipo(),
                organizacion.getDescripcion(),
                organizacion.getDireccion(),
                organizacion.getLatitud(),
                organizacion.getLongitud(),
                organizacion.getEstado(),
                referenteNombre,
                referenteEmail,
                validadoPorNombre
        );
    }

    private String generateSlug(String nombre) {
        if (nombre == null) return null;
        String normalized = Normalizer.normalize(nombre, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "");
        return normalized.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .trim()
                .replaceAll("[\\s]+", "-")
                .replaceAll("-{2,}", "-")
                .replaceAll("^-|-$", "");
    }
}
