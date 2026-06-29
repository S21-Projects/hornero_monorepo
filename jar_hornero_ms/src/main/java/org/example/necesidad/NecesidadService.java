package org.example.necesidad;

import lombok.RequiredArgsConstructor;
import org.example.domain.EstadoNecesidad;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
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

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NecesidadService {

    private final NecesidadRepository necesidadRepository;
    private final OrganizacionRepository organizacionRepository;

    @Transactional
    public NecesidadResponse crear(CrearNecesidadRequest dto, Long referenteId) {
        Organizacion org = organizacionRepository.findByReferente_Id(referenteId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "No organization found for the authenticated referente"));

        Necesidad necesidad = new Necesidad();
        necesidad.setDescripcion(dto.getDescripcion());
        necesidad.setPrioridad(dto.getPrioridad());
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setFechaPublicacion(LocalDate.now());
        necesidad.setFechaVencimiento(dto.getFechaVencimiento());
        necesidad.setOrganizacion(org);

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
        Organizacion org = organizacionRepository.findByReferente_Id(referenteId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Access denied: not the referente of this organization"));
        if (!n.getOrganizacion().getId().equals(org.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Access denied: not the referente of this organization");
        }
    }

    NecesidadResponse toResponse(Necesidad n) {
        return new NecesidadResponse(
                n.getId(),
                n.getDescripcion(),
                n.getPrioridad().name(),
                n.getEstado().name(),
                n.getFechaPublicacion(),
                n.getFechaVencimiento(),
                n.getOrganizacion().getId()
        );
    }
}
