package org.example.necesidad;

import lombok.RequiredArgsConstructor;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NecesidadService {

    private final NecesidadRepository necesidadRepository;

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
