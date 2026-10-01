package org.example.necesidad;

import lombok.RequiredArgsConstructor;
import org.example.auth.VerificacionService;
import org.example.config.AcreditacionProperties;
import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.EstadoNecesidad;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadArticulo;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.necesidad.dto.ActualizarNecesidadRequest;
import org.example.necesidad.dto.CrearNecesidadRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NecesidadService {

    private static final Set<EstadoNecesidad> ESTADOS_ABIERTOS =
            Set.of(EstadoNecesidad.ABIERTA, EstadoNecesidad.EN_PROGRESO);

    private final NecesidadRepository necesidadRepository;
    private final OrganizacionRepository organizacionRepository;
    private final VerificacionService verificacionService;
    private final AcreditacionProperties acreditacionProperties;
    private final ArticuloRepository articuloRepository;

    @Transactional
    public NecesidadResponse crear(CrearNecesidadRequest dto, Long referenteId) {
        verificacionService.requireVerified(referenteId);

        // Feature catalogo-articulos, decision 6: a necesidad MUST declare at least one articulo
        // now — cheap shape check before any repository lookup, mirroring DonacionService's
        // "reject a malformed request cheaply" convention.
        if (dto.getArticuloIds() == null || dto.getArticuloIds().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Necesidad requires at least one articulo");
        }

        Organizacion org = organizacionRepository.findByIdAndReferente_Id(dto.getOrganizacionId(), referenteId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Access denied: not the referente of this organization"));

        // `specs/organizacion-acreditacion/spec.md` "Level-Driven Concurrency Caps".
        NivelAcreditacion nivel = org.getNivel() == null ? NivelAcreditacion.N0 : org.getNivel();
        long cap = acreditacionProperties.capPara(nivel);
        long abiertas = necesidadRepository.countByOrganizacion_IdAndEstadoIn(org.getId(), ESTADOS_ABIERTOS);
        if (abiertas >= cap) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Alcanzaste el máximo de " + cap + " necesidades abiertas para el nivel " + nivel);
        }

        Necesidad necesidad = new Necesidad();
        necesidad.setDescripcion(dto.getDescripcion());
        necesidad.setPrioridad(dto.getPrioridad());
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setFechaPublicacion(LocalDate.now());
        necesidad.setFechaVencimiento(dto.getFechaVencimiento());
        necesidad.setOrganizacion(org);

        // Decision 6: categoria is always derived from the selected articulos, never
        // hand-entered — reject any selection referencing an unknown or deactivated articulo
        // (decision 3: a deactivated articulo must no longer be selectable, but existing
        // references to it keep resolving).
        List<NecesidadArticulo> articulos = resolverArticulos(dto.getArticuloIds(), necesidad);
        CategoriaAlimento categoria = CategoriaAlimento.masExigente(
                articulos.stream().map(na -> na.getArticulo().getCategoria()).collect(Collectors.toList()));

        // `specs/organizacion-acreditacion/spec.md` "Level-Driven Food Category Caps".
        if (categoria.getNivelMinimo().compareTo(nivel) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "La categoría " + categoria + " requiere el nivel " + categoria.getNivelMinimo()
                            + " o superior");
        }

        necesidad.setArticulos(articulos);
        necesidad.setCategoria(categoria);

        return toResponse(necesidadRepository.save(necesidad));
    }

    public Page<NecesidadResponse> findByOrganizacion(Long organizacionId, Pageable pageable) {
        return necesidadRepository.findByOrganizacion_Id(organizacionId, pageable)
                .map(this::toResponse);
    }

    public Page<NecesidadResponse> findAll(Pageable pageable) {
        return necesidadRepository.findAll(pageable)
                .map(this::toResponse);
    }

    public NecesidadResponse findById(Long id) {
        return toResponse(necesidadRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Necesidad not found")));
    }

    @Transactional
    public NecesidadResponse actualizar(Long id, ActualizarNecesidadRequest dto, Long referenteId) {
        Necesidad n = necesidadRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Necesidad not found"));
        checkOwnership(n, referenteId);
        if (dto.getDescripcion() != null) n.setDescripcion(dto.getDescripcion());
        if (dto.getPrioridad() != null) n.setPrioridad(dto.getPrioridad());
        if (dto.getEstado() != null) n.setEstado(dto.getEstado());
        if (dto.getFechaVencimiento() != null) n.setFechaVencimiento(dto.getFechaVencimiento());
        if (dto.getArticuloIds() != null) {
            if (dto.getArticuloIds().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Necesidad requires at least one articulo");
            }
            List<NecesidadArticulo> nuevos = resolverArticulos(dto.getArticuloIds(), n);
            n.getArticulos().clear();
            n.getArticulos().addAll(nuevos);
            n.setCategoria(CategoriaAlimento.masExigente(
                    nuevos.stream().map(na -> na.getArticulo().getCategoria()).collect(Collectors.toList())));
        }
        return toResponse(necesidadRepository.save(n));
    }

    @Transactional
    public void eliminar(Long id, Long referenteId) {
        Necesidad n = necesidadRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Necesidad not found"));
        checkOwnership(n, referenteId);
        necesidadRepository.delete(n);
    }

    private void checkOwnership(Necesidad n, Long referenteId) {
        var referente = n.getOrganizacion().getReferente();
        if (referente == null || !referente.getId().equals(referenteId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Access denied: not the referente of this organization");
        }
    }

    private List<NecesidadArticulo> resolverArticulos(List<Long> articuloIds, Necesidad necesidad) {
        List<NecesidadArticulo> resultado = new ArrayList<>();
        for (Long articuloId : articuloIds) {
            Articulo articulo = articuloRepository.findById(articuloId)
                    .filter(Articulo::isActivo)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Articulo inválido o inactivo: " + articuloId));
            NecesidadArticulo na = new NecesidadArticulo();
            na.setArticulo(articulo);
            na.setNecesidad(necesidad);
            resultado.add(na);
        }
        return resultado;
    }

    NecesidadResponse toResponse(Necesidad n) {
        return new NecesidadResponse(
                n.getId(),
                n.getDescripcion(),
                n.getPrioridad().name(),
                n.getEstado().name(),
                n.getFechaPublicacion(),
                n.getFechaVencimiento(),
                n.getOrganizacion().getId(),
                n.getCategoria(),
                n.getArticulos().stream()
                        .map(na -> new NecesidadArticuloResponse(
                                na.getArticulo().getId(),
                                na.getArticulo().getNombre(),
                                na.getArticulo().getUnidad() != null ? na.getArticulo().getUnidad().name() : null,
                                na.getArticulo().getCategoria() != null ? na.getArticulo().getCategoria().name() : null))
                        .collect(Collectors.toList())
        );
    }
}
