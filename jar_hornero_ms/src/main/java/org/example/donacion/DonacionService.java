package org.example.donacion;

import lombok.RequiredArgsConstructor;
import org.example.domain.DonacionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DonacionService {

    private final DonacionRepository donacionRepository;

    @Transactional(readOnly = true)
    public List<DonacionResponse> findAll() {
        return donacionRepository.findAllWithDonante().stream()
                .map(d -> new DonacionResponse(
                        d.getId(),
                        d.getFechaOferta(),
                        d.getFechaEntrega(),
                        d.getEstado().name(),
                        d.getObservaciones(),
                        d.getDonante().getNombre(),
                        d.getNecesidad().getId(),
                        d.getNecesidad().getOrganizacion().getId()
                ))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<DonacionResponse> findByOrganizacion(Long orgId) {
        return donacionRepository.findByOrganizacionId(orgId).stream()
                .map(d -> new DonacionResponse(
                        d.getId(),
                        d.getFechaOferta(),
                        d.getFechaEntrega(),
                        d.getEstado().name(),
                        d.getObservaciones(),
                        d.getDonante().getNombre(),
                        d.getNecesidad().getId(),
                        d.getNecesidad().getOrganizacion().getId()
                ))
                .collect(Collectors.toList());
    }
}
