package org.example.necesidad;

import lombok.RequiredArgsConstructor;
import org.example.domain.EstadoNecesidad;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.necesidad.dto.CrearNecesidadRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

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

    public List<NecesidadResponse> findByOrganizacion(Long organizacionId) {
        return necesidadRepository.findByOrganizacion_Id(organizacionId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<NecesidadResponse> findAll() {
        return necesidadRepository.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private NecesidadResponse toResponse(Necesidad n) {
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
