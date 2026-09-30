package org.example.donacion;

import lombok.RequiredArgsConstructor;
import org.example.auth.VerificacionService;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DonacionService {

    private final DonacionRepository donacionRepository;
    private final NecesidadRepository necesidadRepository;
    private final UsuarioRepository usuarioRepository;
    private final OrganizacionRepository organizacionRepository;
    private final VerificacionService verificacionService;

    public Page<DonacionResponse> findAll(Pageable pageable) {
        return donacionRepository.findAllWithDonante(pageable)
                .map(this::toResponse);
    }

    public Page<DonacionResponse> findByOrganizacion(Long orgId, Pageable pageable) {
        return donacionRepository.findByOrganizacionId(orgId, pageable)
                .map(this::toResponse);
    }

    @Transactional
    public DonacionResponse crear(CreateDonacionRequest dto, Long donanteId) {
        verificacionService.requireVerified(donanteId);

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

    public Page<DonacionResponse> findMias(Long donanteId, Pageable pageable) {
        return donacionRepository.findByDonante_IdWithRelations(donanteId, pageable)
                .map(this::toResponse);
    }

    public Page<DonacionActivaResponse> findActivas(String q, EstadoDonacion estado, Pageable pageable) {
        Set<EstadoDonacion> estados;
        if (estado == null) {
            estados = EstadoDonacion.NO_TERMINALES;
        } else if (estado.isTerminal()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "estado filter cannot be a terminal state: " + estado);
        } else {
            estados = EnumSet.of(estado);
        }
        return donacionRepository.findActivas(estados, q, pageable)
                .map(this::toActivaResponse);
    }

    public List<DonacionResponse> findDeMisOrganizaciones(Long referenteId, Long organizacionId) {
        if (organizacionId != null) {
            Organizacion org = organizacionRepository.findByIdAndReferente_Id(organizacionId, referenteId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"));
            return donacionRepository.findByOrganizacionId(org.getId()).stream()
                    .map(this::toResponse)
                    .collect(Collectors.toList());
        }
        return donacionRepository.findByOrganizacion_Referente_Id(referenteId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public DonacionResponse decidir(Long id, EstadoDonacion nuevoEstado, Long referenteId) {
        Donacion d = donacionRepository.findByIdWithRelations(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Donacion not found"));
        ParticipantesDonacion.Parte parte = ParticipantesDonacion.parteDe(d, referenteId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"));
        if (parte != ParticipantesDonacion.Parte.REFERENTE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        if (nuevoEstado != EstadoDonacion.ACEPTADA && nuevoEstado != EstadoDonacion.RECHAZADA) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid decision: " + nuevoEstado);
        }
        TransicionesDonacion.validar(d.getEstado(), nuevoEstado);
        d.setEstado(nuevoEstado);
        return toResponse(donacionRepository.save(d));
    }

    @Transactional
    public DonacionResponse actualizarEstado(Long id, EstadoDonacion nuevoEstado, Long donanteId) {
        Donacion d = donacionRepository.findByIdWithRelations(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Donacion not found"));
        if (!d.getDonante().getId().equals(donanteId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        if (nuevoEstado != EstadoDonacion.EN_CAMINO && nuevoEstado != EstadoDonacion.CANCELADA) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid state transition: " + nuevoEstado);
        }
        TransicionesDonacion.validar(d.getEstado(), nuevoEstado);
        d.setEstado(nuevoEstado);
        return toResponse(donacionRepository.save(d));
    }

    @Transactional
    public DonacionResponse overrideEstado(Long id, EstadoDonacion nuevoEstado, String motivo, Long adminId) {
        Donacion d = donacionRepository.findByIdWithRelations(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Donacion not found"));

        if (d.getEstado().isTerminal()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot override a terminal donation");
        }
        if (motivo == null || motivo.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "motivo is required");
        }
        if (nuevoEstado == null || nuevoEstado == d.getEstado()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid override target: " + nuevoEstado);
        }

        if (nuevoEstado == EstadoDonacion.ENTREGADA) {
            if (d.getFechaEntrega() == null) {
                d.setFechaEntrega(LocalDate.now());
            }
            // confirmadaDonanteEn / confirmadaReferenteEn are left untouched: an override
            // is not a party confirmation and must never fabricate consent.
        } else if (nuevoEstado == EstadoDonacion.PENDIENTE_CONFIRMACION) {
            d.setFechaEntrega(null);
            // confirmation timestamps untouched here as well.
        } else {
            d.setFechaEntrega(null);
            d.setConfirmadaDonanteEn(null);
            d.setConfirmadaReferenteEn(null);
        }

        d.setEstado(nuevoEstado);
        d.setOverrideMotivo(motivo);
        d.setOverrideAdminId(adminId);
        d.setOverrideEn(Instant.now());

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

    private DonacionResponse toResponse(Donacion d) {
        String necesidadDescripcion = d.getNecesidad() != null && d.getNecesidad().getDescripcion() != null
                ? d.getNecesidad().getDescripcion() : "";
        String organizacionNombre = d.getNecesidad() != null && d.getNecesidad().getOrganizacion() != null
                ? d.getNecesidad().getOrganizacion().getNombre() : "";
        return new DonacionResponse(
                d.getId(),
                d.getFechaOferta(),
                d.getFechaEntrega(),
                d.getEstado().name(),
                d.getObservaciones(),
                d.getDonante().getNombre(),
                d.getNecesidad().getId(),
                d.getNecesidad().getOrganizacion().getId(),
                necesidadDescripcion,
                organizacionNombre,
                d.getDonante().getId(),
                d.getConfirmadaDonanteEn(),
                d.getConfirmadaReferenteEn()
        );
    }

    private DonacionActivaResponse toActivaResponse(Donacion d) {
        String necesidadDescripcion = d.getNecesidad() != null && d.getNecesidad().getDescripcion() != null
                ? d.getNecesidad().getDescripcion() : "";
        String organizacionNombre = d.getNecesidad() != null && d.getNecesidad().getOrganizacion() != null
                ? d.getNecesidad().getOrganizacion().getNombre() : "";
        return new DonacionActivaResponse(
                d.getId(),
                d.getFechaOferta(),
                d.getFechaEntrega(),
                d.getEstado().name(),
                d.getObservaciones(),
                d.getDonante().getId(),
                d.getDonante().getNombre(),
                d.getNecesidad().getId(),
                necesidadDescripcion,
                d.getNecesidad().getOrganizacion().getId(),
                organizacionNombre,
                d.getConfirmadaDonanteEn(),
                d.getConfirmadaReferenteEn(),
                d.getOverrideMotivo(),
                d.getOverrideAdminId(),
                d.getOverrideEn()
        );
    }
}
