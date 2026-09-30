package org.example.donacion;

import lombok.RequiredArgsConstructor;
import org.example.auth.VerificacionService;
import org.example.config.EsquemaVerificador;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.ModalidadDonacion;
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
    private final EsquemaVerificador esquemaVerificador;

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

        ModalidadDonacion modalidad = dto.getModalidad() != null ? dto.getModalidad() : ModalidadDonacion.DIRECTA;

        // Structural cross-field validation happens before any repository lookup, mirroring the
        // existing `crear_unverifiedDonante_throwsForbiddenBeforeTouchingNecesidad` convention:
        // reject a malformed request cheaply, without touching the DB.
        if (modalidad == ModalidadDonacion.FONDO_COMUN) {
            if (dto.getNecesidadId() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "FONDO_COMUN donations cannot target a necesidad directly");
            }
            if (dto.getCategoria() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "categoria is required for FONDO_COMUN donations");
            }
            if (dto.getLatitud() == null || dto.getLongitud() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "latitud/longitud are required for FONDO_COMUN donations");
            }
            if (!esquemaVerificador.necesidadIdEsNullable()) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "ESQUEMA_PENDIENTE");
            }
        } else {
            if (dto.getNecesidadId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "necesidadId is required for DIRECTA donations");
            }
            if (dto.getCategoria() != null || dto.getLatitud() != null || dto.getLongitud() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "categoria/latitud/longitud are only allowed for FONDO_COMUN donations");
            }
        }

        Donante donante = (Donante) usuarioRepository.findById(donanteId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Donante not found"));

        Donacion d = new Donacion();
        d.setDonante(donante);
        d.setObservaciones(dto.getObservaciones());
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setFechaOferta(LocalDate.now());
        d.setModalidad(modalidad);

        if (modalidad == ModalidadDonacion.FONDO_COMUN) {
            d.setCategoria(dto.getCategoria());
            d.setLatitud(dto.getLatitud());
            d.setLongitud(dto.getLongitud());
            d.setNecesidad(null);
        } else {
            Necesidad necesidad = necesidadRepository.findById(dto.getNecesidadId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Necesidad not found"));
            d.setNecesidad(necesidad);
        }

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

        // AD-3 devolución al fondo: a FONDO_COMUN rejection is NOT a state change to RECHAZADA
        // (OFRECIDA -> OFRECIDA per the AD-5 table) — it only clears the vigente `necesidad`, so the
        // donación becomes eligible for the next ronda again. `Asignacion` bookkeeping (marking the
        // prior assignment RECHAZADA, excluding the org from future rondas) is deferred to slice 5c,
        // which is when `Asignacion` first exists.
        if (nuevoEstado == EstadoDonacion.RECHAZADA
                && d.getModalidadEfectiva() == ModalidadDonacion.FONDO_COMUN) {
            if (d.getEstado() != EstadoDonacion.OFRECIDA || d.getNecesidad() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Invalid state transition: " + d.getEstado() + " -> " + nuevoEstado);
            }
            // Gotcha pinned by AD-3: only null the owning side. Do NOT remove `d` from
            // `necesidad.getDonaciones()` — that collection is `orphanRemoval = true` and doing so
            // would delete this donación row on flush.
            d.setNecesidad(null);
            return toResponse(donacionRepository.save(d));
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
        if (d.getModalidadEfectiva() == ModalidadDonacion.FONDO_COMUN) {
            // AD-3: deletion would orphan any `Asignacion` history row and break the ronda audit
            // trail. Cancelling (the existing OFRECIDA/ACEPTADA/EN_CAMINO -> CANCELADA path) is the
            // only supported way to withdraw a FONDO_COMUN donación.
            throw new ResponseStatusException(HttpStatus.CONFLICT, "USAR_CANCELACION");
        }
        if (d.getEstado() != EstadoDonacion.OFRECIDA) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot delete a donation that is not in OFRECIDA state");
        }
        donacionRepository.delete(d);
    }

    private DonacionResponse toResponse(Donacion d) {
        Necesidad necesidad = d.getNecesidad();
        Organizacion organizacion = necesidad != null ? necesidad.getOrganizacion() : null;
        String necesidadDescripcion = necesidad != null && necesidad.getDescripcion() != null
                ? necesidad.getDescripcion() : "";
        String organizacionNombre = organizacion != null ? organizacion.getNombre() : "";
        return new DonacionResponse(
                d.getId(),
                d.getFechaOferta(),
                d.getFechaEntrega(),
                d.getEstado().name(),
                d.getObservaciones(),
                d.getDonante().getNombre(),
                necesidad != null ? necesidad.getId() : null,
                organizacion != null ? organizacion.getId() : null,
                necesidadDescripcion,
                organizacionNombre,
                d.getDonante().getId(),
                d.getConfirmadaDonanteEn(),
                d.getConfirmadaReferenteEn(),
                d.getModalidadEfectiva().name(),
                d.getCategoria() != null ? d.getCategoria().name() : null,
                FaseDonacion.de(d).name()
        );
    }

    private DonacionActivaResponse toActivaResponse(Donacion d) {
        Necesidad necesidad = d.getNecesidad();
        Organizacion organizacion = necesidad != null ? necesidad.getOrganizacion() : null;
        String necesidadDescripcion = necesidad != null && necesidad.getDescripcion() != null
                ? necesidad.getDescripcion() : "";
        String organizacionNombre = organizacion != null ? organizacion.getNombre() : "";
        return new DonacionActivaResponse(
                d.getId(),
                d.getFechaOferta(),
                d.getFechaEntrega(),
                d.getEstado().name(),
                d.getObservaciones(),
                d.getDonante().getId(),
                d.getDonante().getNombre(),
                necesidad != null ? necesidad.getId() : null,
                necesidadDescripcion,
                organizacion != null ? organizacion.getId() : null,
                organizacionNombre,
                d.getConfirmadaDonanteEn(),
                d.getConfirmadaReferenteEn(),
                d.getOverrideMotivo(),
                d.getOverrideAdminId(),
                d.getOverrideEn(),
                d.getModalidadEfectiva().name(),
                d.getCategoria() != null ? d.getCategoria().name() : null,
                FaseDonacion.de(d).name()
        );
    }
}
