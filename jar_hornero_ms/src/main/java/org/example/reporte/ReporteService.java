package org.example.reporte;

import lombok.RequiredArgsConstructor;
import org.example.acreditacion.AcreditacionService;
import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.TipoActividad;
import org.example.auth.VerificacionService;
import org.example.common.Restricciones;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.EstadoReporte;
import org.example.domain.MotivoReporte;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.OrigenOrganizacion;
import org.example.domain.ReporteOrganizacion;
import org.example.domain.ReporteOrganizacionRepository;
import org.example.domain.TipoEventoOrganizacion;
import org.example.reclamo.ReclamoService;
import org.example.reporte.dto.CrearReporteRequest;
import org.example.reporte.dto.OrganizacionCercanaResponse;
import org.example.reporte.dto.ReporteResponse;
import org.example.user.Administrador;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

/**
 * Report flow for unclaimed (ReNaCoM-imported) organizaciones. Any authenticated user reports; an
 * administrador either marks the organizacion INACTIVA (confirming every pending report on it) or
 * discards one report with a note. State changes run in one transaction with their org event and
 * activity entries; {@code @Version} on the report and the organizacion keeps concurrent
 * resolutions from both winning.
 */
@Service
@RequiredArgsConstructor
public class ReporteService {

    public static final int RADIO_CERCANAS_METROS = 500;
    /** Most reports one user may have PENDIENTE at the same time. */
    public static final int MAX_PENDIENTES_POR_USUARIO = 10;
    static final String LIMITE_REPORTES_PENDIENTES = "LIMITE_REPORTES_PENDIENTES";
    static final String INDICE_PENDIENTE = "ux_reporte_pendiente";
    static final String MOTIVO_INACTIVA = "La organización fue marcada inactiva";
    static final String MSG_REPORTE_PENDIENTE = "Ya tenés un reporte pendiente para este comedor";
    static final String NOTA_CONFIRMADO_CON_OTRO = "Confirmado junto con otro reporte sobre el mismo comedor";
    private static final double METROS_POR_GRADO = 111_320.0;
    private static final double RADIO_TIERRA_METROS = 6_371_000.0;

    private final ReporteOrganizacionRepository reporteRepository;
    private final OrganizacionRepository organizacionRepository;
    private final UsuarioRepository usuarioRepository;
    private final AcreditacionService acreditacionService;
    private final ActividadService actividadService;
    private final VerificacionService verificacionService;
    private final ReporteThrottle reporteThrottle;
    private final ReporteCierre reporteCierre;
    private final ReclamoService reclamoService;

    @Transactional
    public ReporteResponse crear(CrearReporteRequest request, Long userId) {
        verificacionService.requireVerified(userId);
        Usuario usuario = usuarioRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));
        Organizacion organizacion = buscarOrganizacion(request.organizacionId());
        exigirReportable(organizacion);
        if (reporteRepository.existsByOrganizacion_IdAndReportante_IdAndEstado(
                organizacion.getId(), userId, EstadoReporte.PENDIENTE)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, MSG_REPORTE_PENDIENTE);
        }
        if (reporteRepository.countByReportante_IdAndEstado(userId, EstadoReporte.PENDIENTE) >= MAX_PENDIENTES_POR_USUARIO) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, LIMITE_REPORTES_PENDIENTES);
        }
        Organizacion duplicada = resolverDuplicada(request, organizacion);
        // Last check: only well-formed submissions count against the daily cap.
        reporteThrottle.checkAndRecord(userId);

        ReporteOrganizacion reporte = new ReporteOrganizacion();
        reporte.setOrganizacion(organizacion);
        reporte.setReportante(usuario);
        reporte.setMotivo(request.motivo());
        reporte.setOrganizacionDuplicada(duplicada);
        reporte.setDetalle(request.detalle() == null || request.detalle().isBlank() ? null : request.detalle().trim());
        ReporteOrganizacion saved;
        try {
            saved = reporteRepository.saveAndFlush(reporte);
        } catch (DataIntegrityViolationException e) {
            // ux_reporte_pendiente (V009): a concurrent duplicate got past the existsBy check.
            // Any other integrity failure is a real error, not "already pending".
            if (!Restricciones.viola(e, INDICE_PENDIENTE)) {
                throw e;
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT, MSG_REPORTE_PENDIENTE);
        }
        // The free-text detalle stays out of the log.
        actividadService.registrar(Registro.de(TipoActividad.REPORTE_CREADO)
                .entidad("REPORTE", saved.getId()).detalle(organizacion.getNombre()));
        return toResponse(saved);
    }

    /** Platform organizaciones within {@value #RADIO_CERCANAS_METROS} m of a reportable organizacion, nearest first. */
    @Transactional(readOnly = true)
    public List<OrganizacionCercanaResponse> cercanas(Long organizacionId) {
        Organizacion organizacion = buscarOrganizacion(organizacionId);
        exigirReportable(organizacion);
        Double lat = organizacion.getLatitud();
        Double lng = organizacion.getLongitud();
        if (lat == null || lng == null) {
            return List.of();
        }
        // Box a little wider than the radius; the haversine below is the exact filter.
        double dLat = (RADIO_CERCANAS_METROS * 1.2) / METROS_POR_GRADO;
        double dLng = dLat / Math.max(Math.cos(Math.toRadians(lat)), 0.01);
        return organizacionRepository
                .findPlataformaAprobadasEnCaja(lat - dLat, lat + dLat, lng - dLng, lng + dLng).stream()
                .filter(o -> !o.getId().equals(organizacion.getId()))
                .map(o -> new OrganizacionCercanaResponse(o.getId(), o.getSlug(), o.getNombre(), o.getDireccion(),
                        (int) Math.round(distanciaMetros(lat, lng, o.getLatitud(), o.getLongitud()))))
                .filter(c -> c.distanciaMetros() <= RADIO_CERCANAS_METROS)
                .sorted(Comparator.comparingInt(OrganizacionCercanaResponse::distanciaMetros))
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<ReporteResponse> listarPendientes(Pageable pageable) {
        return reporteRepository.findByEstado(EstadoReporte.PENDIENTE, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ReporteResponse detalle(Long id) {
        return toResponse(buscar(id));
    }

    @Transactional
    public ReporteResponse marcarInactiva(Long id, Long adminUserId) {
        Administrador admin = requireAdministrador(adminUserId);
        ReporteOrganizacion reporte = buscar(id);
        exigirPendiente(reporte);

        // Loaded explicitly (not through the lazy proxy) so the version read here is the one the
        // UPDATE below is checked against.
        Organizacion organizacion = buscarOrganizacion(reporte.getOrganizacion().getId());
        if (!EstadoOrganizacion.SIN_RECLAMAR.equals(organizacion.getEstado())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este comedor ya no está sin reclamar");
        }
        organizacion.setEstado(EstadoOrganizacion.INACTIVA);
        organizacionRepository.saveAndFlush(organizacion);

        confirmar(reporte, admin, null);
        for (ReporteOrganizacion otro : reporteRepository
                .findByOrganizacion_IdAndEstado(organizacion.getId(), EstadoReporte.PENDIENTE)) {
            if (!otro.getId().equals(reporte.getId())) {
                confirmar(otro, admin, NOTA_CONFIRMADO_CON_OTRO);
            }
        }
        // The organizacion is closed: pending claims on it can no longer be approved.
        reclamoService.rechazarPendientesDeOrganizacion(organizacion.getId(), admin, MOTIVO_INACTIVA);
        return toResponse(reporte);
    }

    @Transactional
    public ReporteResponse descartar(Long id, String nota, Long adminUserId) {
        Administrador admin = requireAdministrador(adminUserId);
        if (nota == null || nota.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La nota de resolución es obligatoria");
        }
        ReporteOrganizacion reporte = buscar(id);
        exigirPendiente(reporte);
        reporteCierre.descartar(reporte, admin, nota.trim());
        return toResponse(reporte);
    }

    // --- helpers ---

    private void confirmar(ReporteOrganizacion reporte, Administrador admin, String nota) {
        reporte.setEstado(EstadoReporte.CONFIRMADO);
        reporte.setNotaResolucion(nota);
        resolver(reporte, admin);
        reporteRepository.save(reporte);
        acreditacionService.registrarResolucionReclamo(reporte.getOrganizacion(),
                TipoEventoOrganizacion.REPORTE_CONFIRMADO, admin,
                "Reporte #" + reporte.getId() + " confirmado: comedor marcado como inactivo");
        actividadService.registrar(Registro.de(TipoActividad.REPORTE_CONFIRMADO)
                .entidad("REPORTE", reporte.getId()).detalle(reporte.getOrganizacion().getNombre())
                .actor(admin).cambio(EstadoReporte.PENDIENTE, EstadoReporte.CONFIRMADO));
    }

    private Organizacion resolverDuplicada(CrearReporteRequest request, Organizacion reportada) {
        if (request.motivo() != MotivoReporte.DUPLICADO) {
            if (request.organizacionDuplicadaId() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Solo un reporte por duplicado puede indicar otra organización");
            }
            return null;
        }
        Long duplicadaId = request.organizacionDuplicadaId();
        if (duplicadaId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indicá con qué organización de Hornero es el mismo");
        }
        if (duplicadaId.equals(reportada.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La organización duplicada no puede ser la reportada");
        }
        Organizacion duplicada = organizacionRepository.findById(duplicadaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "La organización duplicada no existe"));
        // Same visibility rule as the picker (nearby endpoint): a validated platform organizacion.
        if (duplicada.origenEfectivo() != OrigenOrganizacion.PLATAFORMA
                || !EstadoOrganizacion.APROBADA.equals(duplicada.getEstado())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La organización duplicada debe ser una organización validada de Hornero");
        }
        return duplicada;
    }

    private static void exigirReportable(Organizacion organizacion) {
        if (!EstadoOrganizacion.SIN_RECLAMAR.equals(organizacion.getEstado())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este comedor no se puede reportar");
        }
    }

    private static void resolver(ReporteOrganizacion reporte, Administrador admin) {
        reporte.setResueltoPor(admin);
        reporte.setResueltoEn(Instant.now());
    }

    private static void exigirPendiente(ReporteOrganizacion reporte) {
        if (reporte.getEstado() != EstadoReporte.PENDIENTE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El reporte ya fue resuelto");
        }
    }

    private ReporteOrganizacion buscar(Long id) {
        return reporteRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reporte no encontrado"));
    }

    private Organizacion buscarOrganizacion(Long id) {
        return organizacionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));
    }

    private Administrador requireAdministrador(Long userId) {
        Usuario usuario = usuarioRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));
        if (!(usuario instanceof Administrador admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo los administradores pueden resolver reportes");
        }
        return admin;
    }

    static double distanciaMetros(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * RADIO_TIERRA_METROS * Math.asin(Math.sqrt(a));
    }

    private ReporteResponse toResponse(ReporteOrganizacion r) {
        Organizacion org = r.getOrganizacion();
        Usuario rep = r.getReportante();
        Organizacion dup = r.getOrganizacionDuplicada();
        return new ReporteResponse(
                r.getId(), org.getId(), org.getNombre(), org.getSlug(), org.getDireccion(),
                rep.getId(), rep.getNombre(), rep.getEmail(),
                r.getMotivo(),
                dup != null ? dup.getId() : null, dup != null ? dup.getNombre() : null,
                dup != null ? dup.getSlug() : null,
                r.getDetalle(), r.getEstado(), r.getNotaResolucion(),
                r.getResueltoPor() != null ? r.getResueltoPor().getNombre() : null,
                r.getCreadoEn(), r.getResueltoEn());
    }
}
