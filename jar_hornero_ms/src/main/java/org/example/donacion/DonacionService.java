package org.example.donacion;

import lombok.RequiredArgsConstructor;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.donacion.dto.CreateDonacionRequest;
import org.example.user.Donante;
import org.example.user.UsuarioRepository;
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
public class DonacionService {

    private final DonacionRepository donacionRepository;
    private final NecesidadRepository necesidadRepository;
    private final UsuarioRepository usuarioRepository;
    private final OrganizacionRepository organizacionRepository;

    public List<DonacionResponse> findAll() {
        return donacionRepository.findAllWithDonante().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<DonacionResponse> findByOrganizacion(Long orgId) {
        return donacionRepository.findByOrganizacionId(orgId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public DonacionResponse crear(CreateDonacionRequest dto, Long donanteId) {
        Necesidad necesidad = necesidadRepository.findById(dto.getNecesidadId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Necesidad not found"));
        Donante donante = (Donante) usuarioRepository.findById(donanteId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Donante not found"));
        Donacion d = new Donacion();
        d.setNecesidad(necesidad);
        d.setDonante(donante);
        d.setObservaciones(dto.getObservaciones());
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setFechaOferta(LocalDate.now());
        return toResponse(donacionRepository.save(d));
    }

    public DonacionResponse findById(Long id) {
        return toResponse(donacionRepository.findByIdWithRelations(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Donacion not found")));
    }

    public List<DonacionResponse> findMias(Long donanteId) {
        return donacionRepository.findByDonante_IdWithRelations(donanteId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public DonacionResponse actualizarEstado(Long id, EstadoDonacion nuevoEstado, Long referenteId) {
        Donacion d = donacionRepository.findByIdWithRelations(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Donacion not found"));
        Organizacion org = organizacionRepository.findByReferente_Id(referenteId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"));
        if (!d.getNecesidad().getOrganizacion().getId().equals(org.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        validateTransition(d.getEstado(), nuevoEstado);
        d.setEstado(nuevoEstado);
        if (nuevoEstado == EstadoDonacion.ENTREGADA) {
            d.setFechaEntrega(LocalDate.now());
        }
        return toResponse(donacionRepository.save(d));
    }

    @Transactional
    public void eliminar(Long id, Long donanteId) {
        Donacion d = donacionRepository.findByIdWithRelations(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Donacion not found"));
        if (!d.getDonante().getId().equals(donanteId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: not the owner of this donation");
        }
        if (d.getEstado() != EstadoDonacion.OFRECIDA) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot delete a donation that is not in OFRECIDA state");
        }
        donacionRepository.delete(d);
    }

    private void validateTransition(EstadoDonacion current, EstadoDonacion next) {
        boolean valid = switch (current) {
            case OFRECIDA -> next == EstadoDonacion.EN_CAMINO || next == EstadoDonacion.CANCELADA;
            case EN_CAMINO -> next == EstadoDonacion.ENTREGADA || next == EstadoDonacion.CANCELADA;
            default -> false;
        };
        if (!valid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid state transition: " + current + " -> " + next);
        }
    }

    private DonacionResponse toResponse(Donacion d) {
        return new DonacionResponse(
                d.getId(),
                d.getFechaOferta(),
                d.getFechaEntrega(),
                d.getEstado().name(),
                d.getObservaciones(),
                d.getDonante().getNombre(),
                d.getNecesidad().getId(),
                d.getNecesidad().getOrganizacion().getId()
        );
    }
}
