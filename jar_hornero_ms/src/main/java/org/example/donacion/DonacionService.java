package org.example.donacion;

import lombok.RequiredArgsConstructor;
import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.TipoActividad;
import org.example.auth.VerificacionService;
import org.example.config.EsquemaVerificador;
import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.example.domain.Asignacion;
import org.example.domain.AsignacionRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.Donacion;
import org.example.domain.DonacionLinea;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoAsignacion;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.ModalidadDonacion;
import org.example.domain.Necesidad;
import org.example.domain.NivelAcreditacion;
import org.example.domain.NecesidadRepository;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.donacion.dto.CreateDonacionRequest;
import org.example.donacion.dto.DonacionLineaRequest;
import org.example.user.Donante;
import org.example.user.UsuarioRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DonacionService {

    private static final Set<EstadoNecesidad> ESTADOS_ABIERTOS =
            EnumSet.of(EstadoNecesidad.ABIERTA, EstadoNecesidad.EN_PROGRESO);

    private final DonacionRepository donacionRepository;
    private final NecesidadRepository necesidadRepository;
    private final UsuarioRepository usuarioRepository;
    private final OrganizacionRepository organizacionRepository;
    private final VerificacionService verificacionService;
    private final EsquemaVerificador esquemaVerificador;
    private final AsignacionRepository asignacionRepository;
    private final ArticuloRepository articuloRepository;
    private final DonanteVisibilidad donanteVisibilidad;
    private final Clock clock;
    private final ActividadService actividadService;

    public Page<DonacionResponse> findAll(Pageable pageable) {
        return donacionRepository.findAllWithDonante(pageable)
                .map(this::toResponse)
                .map(donanteVisibilidad.paraLlamadaActual());
    }

    public Page<DonacionResponse> findByOrganizacion(Long orgId, Pageable pageable) {
        return donacionRepository.findByOrganizacionId(orgId, pageable)
                .map(this::toResponse)
                .map(donanteVisibilidad.paraLlamadaActual());
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
            if (dto.getLatitud() != null || dto.getLongitud() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "latitud/longitud are only allowed for FONDO_COMUN donations");
            }
        }

        // Feature catalogo-articulos, decision 4: every donación (both modalidades) requires at
        // least one línea. Cheap shape check before any articulo lookup.
        if (dto.getLineas() == null || dto.getLineas().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Donación requires at least one línea (articulo + cantidad)");
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
            d.setLatitud(dto.getLatitud());
            d.setLongitud(dto.getLongitud());
            d.setNecesidad(null);
        } else {
            Necesidad necesidad = necesidadRepository.findById(dto.getNecesidadId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Necesidad not found"));
            // D1: donors can only donate to an approved organization (nivel >= N1). A null nivel
            // is a not-yet-backfilled row and reads as N0. Checked before any write.
            NivelAcreditacion nivel = necesidad.getOrganizacion().getNivel();
            if (nivel == null || nivel == NivelAcreditacion.N0) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "ORGANIZACION_NO_APROBADA: la organización aún no está aprobada para recibir donaciones");
            }
            // D2/N3: only an open, unexpired necesidad accepts donations. The date check is
            // independent of the daily expiry job, so a necesidad is closed to donors from the
            // first day past its fechaVencimiento even if the job has not run yet.
            LocalDate hoy = LocalDate.now(clock);
            if (!ESTADOS_ABIERTOS.contains(necesidad.getEstado())
                    || (necesidad.getFechaVencimiento() != null && necesidad.getFechaVencimiento().isBefore(hoy))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "NECESIDAD_NO_DISPONIBLE: la necesidad está cerrada o vencida");
            }
            d.setNecesidad(necesidad);
        }

        // Decision 5: categoria is always derived from the lines, never hand-entered — reject any
        // línea whose articulo is unknown or deactivated (decision 3: a deactivated articulo must
        // no longer be offerable, but existing references to it keep resolving).
        List<DonacionLinea> lineas = new ArrayList<>();
        List<CategoriaAlimento> categorias = new ArrayList<>();
        for (DonacionLineaRequest lr : dto.getLineas()) {
            Articulo articulo = articuloRepository.findById(lr.getArticuloId())
                    .filter(Articulo::isActivo)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Articulo inválido o inactivo: " + lr.getArticuloId()));
            DonacionLinea linea = new DonacionLinea();
            linea.setArticulo(articulo);
            linea.setCantidad(lr.getCantidad());
            linea.setDonacion(d);
            lineas.add(linea);
            categorias.add(articulo.getCategoria());
        }
        d.setLineas(lineas);
        d.setCategoria(CategoriaAlimento.masExigente(categorias));

        // Closes the C5 gap (feature catalogo-articulos, decision 6): a DIRECTA donación must
        // offer at least one articulo the target necesidad actually requested — otherwise the
        // match carries no real signal, same spirit as the ronda's articulo-level hard filter.
        if (modalidad != ModalidadDonacion.FONDO_COMUN) {
            Set<Long> articulosSolicitados = d.getNecesidad().getArticulos().stream()
                    .map(na -> na.getArticulo().getId())
                    .collect(Collectors.toSet());
            boolean compatible = lineas.stream()
                    .anyMatch(l -> articulosSolicitados.contains(l.getArticulo().getId()));
            if (!compatible) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "ARTICULO_INCOMPATIBLE: la donación no incluye ningún articulo solicitado por la necesidad");
            }
        }

        Donacion guardada = donacionRepository.save(d);
        actividadService.registrar(Registro.de(TipoActividad.DONACION_CREADA)
                .entidad("DONACION", guardada.getId())
                .cambio(null, EstadoDonacion.OFRECIDA)
                .detalle("modalidad " + modalidad));
        return toResponse(guardada);
    }

    public DonacionResponse findById(Long id) {
        return donanteVisibilidad.paraLlamadaActual().apply(toResponse(donacionRepository.findByIdWithRelations(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Donacion not found"))));
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
        // donación becomes eligible for the next ronda again. The prior `Asignacion` resolves to
        // RECHAZADA (slice 5c-ii), excluding the org from future rondas for this donación (AD-9).
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
            DonacionResponse response = toResponse(donacionRepository.save(d));
            resolverAsignacionVigente(id, EstadoAsignacion.RECHAZADA);
            actividadService.registrar(Registro.de(TipoActividad.DONACION_DECISION)
                    .entidad("DONACION", id).cambio(d.getEstado(), d.getEstado())
                    .detalle("rechazada por la organización, devuelta al fondo común"));
            return response;
        }

        TransicionesDonacion.validar(d.getEstado(), nuevoEstado);
        EstadoDonacion estadoAntes = d.getEstado();
        d.setEstado(nuevoEstado);
        DonacionResponse response = toResponse(donacionRepository.save(d));
        actividadService.registrar(Registro.de(TipoActividad.DONACION_DECISION)
                .entidad("DONACION", id).cambio(estadoAntes, nuevoEstado));
        if (nuevoEstado == EstadoDonacion.ACEPTADA) {
            resolverAsignacionVigente(id, EstadoAsignacion.ACEPTADA);
        }
        return response;
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
        EstadoDonacion estadoAntes = d.getEstado();
        d.setEstado(nuevoEstado);
        DonacionResponse response = toResponse(donacionRepository.save(d));
        actividadService.registrar(Registro.de(
                        nuevoEstado == EstadoDonacion.CANCELADA
                                ? TipoActividad.DONACION_CANCELADA : TipoActividad.DONACION_ESTADO_ACTUALIZADO)
                .entidad("DONACION", id).cambio(estadoAntes, nuevoEstado));
        if (nuevoEstado == EstadoDonacion.CANCELADA) {
            resolverAsignacionVigente(id, EstadoAsignacion.CANCELADA);
        }
        return response;
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

        EstadoDonacion estadoAntes = d.getEstado();
        d.setEstado(nuevoEstado);
        d.setOverrideMotivo(motivo);
        d.setOverrideAdminId(adminId);
        d.setOverrideEn(Instant.now());

        DonacionResponse response = toResponse(donacionRepository.save(d));
        actividadService.registrar(Registro.de(TipoActividad.DONACION_OVERRIDE)
                .entidad("DONACION", id).cambio(estadoAntes, nuevoEstado).motivo(motivo));
        if (nuevoEstado == EstadoDonacion.ACEPTADA
                || nuevoEstado == EstadoDonacion.RECHAZADA
                || nuevoEstado == EstadoDonacion.CANCELADA) {
            resolverAsignacionVigente(id, EstadoAsignacion.valueOf(nuevoEstado.name()));
        }
        return response;
    }

    /**
     * Resolves the vigente (still-{@code PROPUESTA}) {@link Asignacion} for a donación to the
     * matching terminal {@link EstadoAsignacion} — AD-3/AD-9, slice 5c-ii. A no-op for a
     * {@code DIRECTA} donación or any donación the worker never assigned (no {@code PROPUESTA} row).
     */
    private void resolverAsignacionVigente(Long donacionId, EstadoAsignacion destino) {
        asignacionRepository
                .findFirstByDonacion_IdAndEstadoOrderByCreadaEnDesc(donacionId, EstadoAsignacion.PROPUESTA)
                .ifPresent(asignacion -> {
                    asignacion.setEstado(destino);
                    asignacion.setResueltaEn(Instant.now());
                    asignacionRepository.save(asignacion);
                });
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
        actividadService.registrar(Registro.de(TipoActividad.DONACION_ELIMINADA)
                .entidad("DONACION", id).cambio(d.getEstado(), null));
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
                FaseDonacion.de(d).name(),
                toLineaResponses(d)
        );
    }

    private List<DonacionLineaResponse> toLineaResponses(Donacion d) {
        return d.getLineas().stream()
                .map(l -> new DonacionLineaResponse(
                        l.getArticulo().getId(),
                        l.getArticulo().getNombre(),
                        l.getArticulo().getUnidad() != null ? l.getArticulo().getUnidad().name() : null,
                        l.getCantidad()))
                .collect(Collectors.toList());
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
                FaseDonacion.de(d).name(),
                toLineaResponses(d)
        );
    }
}
