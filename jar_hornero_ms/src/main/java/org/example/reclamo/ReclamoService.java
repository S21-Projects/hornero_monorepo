package org.example.reclamo;

import lombok.RequiredArgsConstructor;
import org.example.acreditacion.AcreditacionService;
import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.TipoActividad;
import org.example.auth.VerificacionService;
import org.example.common.Restricciones;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.EstadoReclamo;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.ReclamoOrganizacion;
import org.example.domain.ReclamoOrganizacionRepository;
import org.example.domain.TipoEventoOrganizacion;
import org.example.organizacion.OrganizacionService;
import org.example.reclamo.dto.CrearReclamoRequest;
import org.example.reclamo.dto.ReclamoResponse;
import org.example.reporte.ReporteCierre;
import org.example.user.Administrador;
import org.example.user.Referente;
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
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Claim flow for unclaimed (ReNaCoM-imported) organizaciones. A referente submits; an administrador
 * approves (assigning the organizacion) or rejects with a reason. Every state-changing path runs in
 * one transaction with its org event and activity entries, and relies on {@code @Version} on both
 * the claim and the organizacion so that concurrent resolutions cannot both win.
 */
@Service
@RequiredArgsConstructor
public class ReclamoService {

    static final String MSG_RECLAMO_PENDIENTE = "Ya tenés un reclamo pendiente para este comedor";
    static final String INDICE_PENDIENTE = "ux_reclamo_pendiente";
    static final String MOTIVO_OTRO_RECLAMO_APROBADO = "Se aprobó otro reclamo para este comedor";
    private static final Pattern OBJECT_KEY_PATTERN = Pattern.compile("^reclamo-evidencia/(\\d+)/(\\d+)/[^/]+$");

    private final ReclamoOrganizacionRepository reclamoRepository;
    private final OrganizacionRepository organizacionRepository;
    private final UsuarioRepository usuarioRepository;
    private final OrganizacionService organizacionService;
    private final AcreditacionService acreditacionService;
    private final ActividadService actividadService;
    private final VerificacionService verificacionService;
    private final ReporteCierre reporteCierre;

    @Transactional
    public ReclamoResponse crear(CrearReclamoRequest request, Long userId) {
        verificacionService.requireVerified(userId);
        Usuario usuario = usuarioRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));
        if (!(usuario instanceof Referente referente)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo los referentes pueden reclamar un comedor");
        }
        Organizacion organizacion = organizacionRepository.findById(request.organizacionId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        exigirReclamable(organizacion, referente);
        validarEvidencias(request.evidenciaKeys(), organizacion.getId(), referente.getId());

        ReclamoOrganizacion reclamo = new ReclamoOrganizacion();
        reclamo.setOrganizacion(organizacion);
        reclamo.setReferente(referente);
        reclamo.setRol(request.rol());
        reclamo.setTelefono(request.telefono().trim());
        reclamo.setMensaje(request.mensaje() == null || request.mensaje().isBlank() ? null : request.mensaje().trim());
        reclamo.setEvidenciaKeys(new java.util.ArrayList<>(request.evidenciaKeys()));
        ReclamoOrganizacion saved;
        try {
            saved = reclamoRepository.saveAndFlush(reclamo);
        } catch (DataIntegrityViolationException e) {
            // ux_reclamo_pendiente (V008): a concurrent duplicate got past the existsBy check.
            // Any other integrity failure is a real error, not "already pending".
            if (!Restricciones.viola(e, INDICE_PENDIENTE)) {
                throw e;
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT, MSG_RECLAMO_PENDIENTE);
        }

        // Field values (telefono, mensaje, keys) stay out of the log.
        actividadService.registrar(Registro.de(TipoActividad.RECLAMO_CREADO)
                .entidad("RECLAMO", saved.getId()).detalle(organizacion.getNombre()));
        return toResponse(saved, null);
    }

    /**
     * Cheap pre-flight for the BFF evidence upload: 404 / 409 with the same rules as {@link #crear}
     * (org exists and is SIN_RECLAMAR, no pending claim of the caller, cap not reached), 403 for non-referentes.
     */
    @Transactional(readOnly = true)
    public void verificarReclamable(Long organizacionId, Long userId) {
        verificacionService.requireVerified(userId);
        Usuario usuario = usuarioRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));
        if (!(usuario instanceof Referente referente)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo los referentes pueden reclamar un comedor");
        }
        Organizacion organizacion = organizacionRepository.findById(organizacionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));
        exigirReclamable(organizacion, referente);
    }

    private void exigirReclamable(Organizacion organizacion, Referente referente) {
        if (!EstadoOrganizacion.SIN_RECLAMAR.equals(organizacion.getEstado())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este comedor no está disponible para ser reclamado");
        }
        if (reclamoRepository.existsByOrganizacion_IdAndReferente_IdAndEstado(
                organizacion.getId(), referente.getId(), EstadoReclamo.PENDIENTE)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, MSG_RECLAMO_PENDIENTE);
        }
        if (organizacionService.contarACargo(referente.getId()) >= OrganizacionService.CAP_ORGANIZACIONES) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Alcanzaste el máximo de " + OrganizacionService.CAP_ORGANIZACIONES + " organizaciones");
        }
    }

    @Transactional(readOnly = true)
    public List<ReclamoResponse> listarMios(Long userId) {
        return reclamoRepository.findByReferente_IdOrderByCreadoEnDescIdDesc(userId).stream()
                .map(r -> toResponse(r, null))
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<ReclamoResponse> listarPendientes(Pageable pageable) {
        return reclamoRepository.findByEstado(EstadoReclamo.PENDIENTE, pageable).map(r -> toResponse(r, null));
    }

    /** Admin sees any claim (with the claimant's n/3 load); the claimant sees only their own. */
    @Transactional(readOnly = true)
    public ReclamoResponse detalle(Long id, Long userId, boolean esAdmin) {
        ReclamoOrganizacion reclamo = buscar(id);
        if (esAdmin) {
            long aCargo = organizacionService.contarACargo(reclamo.getReferente().getId());
            return toResponse(reclamo, (int) aCargo);
        }
        if (!reclamo.getReferente().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No sos el solicitante de este reclamo");
        }
        return toResponse(reclamo, null);
    }

    @Transactional
    public ReclamoResponse aprobar(Long id, Long adminUserId) {
        Administrador admin = requireAdministrador(adminUserId);
        ReclamoOrganizacion reclamo = buscar(id);
        exigirPendiente(reclamo);

        // Loaded explicitly (not through the lazy proxy) so the version read here is the one the
        // assignment's UPDATE is checked against.
        Organizacion organizacion = organizacionRepository.findById(reclamo.getOrganizacion().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));
        organizacionService.asignarPorReclamo(organizacion, reclamo.getReferente(), admin);

        reclamo.setEstado(EstadoReclamo.APROBADO);
        resolver(reclamo, admin);
        reclamoRepository.save(reclamo);
        acreditacionService.registrarResolucionReclamo(organizacion, TipoEventoOrganizacion.RECLAMO_APROBADO,
                admin, "Reclamo #" + reclamo.getId() + " aprobado");
        actividadService.registrar(Registro.de(TipoActividad.RECLAMO_APROBADO)
                .entidad("RECLAMO", reclamo.getId()).detalle(organizacion.getNombre()).actor(admin)
                .cambio(EstadoReclamo.PENDIENTE, EstadoReclamo.APROBADO));

        // Every other pending claim on this organizacion lost: reject with a system reason.
        for (ReclamoOrganizacion otro : reclamoRepository
                .findByOrganizacion_IdAndEstado(organizacion.getId(), EstadoReclamo.PENDIENTE)) {
            if (!otro.getId().equals(reclamo.getId())) {
                cerrarComoRechazado(otro, admin, MOTIVO_OTRO_RECLAMO_APROBADO);
            }
        }
        // The organizacion now has an owner: reports about it being unclaimed are moot.
        reporteCierre.descartarPendientes(organizacion.getId(), admin, ReporteCierre.NOTA_RECLAMADA);
        return toResponse(reclamo, null);
    }

    /** Rejects every PENDIENTE claim on an organizacion that can no longer be claimed (marked inactive). */
    @Transactional
    public void rechazarPendientesDeOrganizacion(Long organizacionId, Administrador admin, String motivo) {
        for (ReclamoOrganizacion r : reclamoRepository
                .findByOrganizacion_IdAndEstado(organizacionId, EstadoReclamo.PENDIENTE)) {
            cerrarComoRechazado(r, admin, motivo);
        }
    }

    /** Rejects every PENDIENTE claim filed by a referente whose account was anonymized. */
    @Transactional
    public void rechazarPendientesDeReferente(Long referenteId, Administrador admin, String motivo) {
        for (ReclamoOrganizacion r : reclamoRepository
                .findByReferente_IdAndEstado(referenteId, EstadoReclamo.PENDIENTE)) {
            cerrarComoRechazado(r, admin, motivo);
        }
    }

    @Transactional
    public ReclamoResponse rechazar(Long id, String motivo, Long adminUserId) {
        Administrador admin = requireAdministrador(adminUserId);
        if (motivo == null || motivo.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El motivo del rechazo es obligatorio");
        }
        ReclamoOrganizacion reclamo = buscar(id);
        exigirPendiente(reclamo);
        cerrarComoRechazado(reclamo, admin, motivo.trim());
        return toResponse(reclamo, null);
    }

    /** Authorizes reading an evidence file: bound to a row, and requested by an admin or by its own claimant. */
    @Transactional(readOnly = true)
    public void verificarArchivo(Long organizacionId, Long solicitanteId, String objectKey, Long userId,
                                 boolean esAdmin) {
        Matcher matcher = objectKey == null ? null : OBJECT_KEY_PATTERN.matcher(objectKey);
        boolean claveValida = matcher != null && matcher.matches()
                && matcher.group(1).equals(String.valueOf(organizacionId))
                && matcher.group(2).equals(String.valueOf(solicitanteId));
        if (!claveValida) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EVIDENCIA_CLAVE_INVALIDA");
        }
        if (!esAdmin && !solicitanteId.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No sos el solicitante de este reclamo");
        }
        if (!reclamoRepository.existeEvidenciaDeReferente(organizacionId, solicitanteId, objectKey)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "EVIDENCIA_NO_ENCONTRADA");
        }
    }

    // --- helpers ---

    private void cerrarComoRechazado(ReclamoOrganizacion reclamo, Administrador admin, String motivo) {
        reclamo.setEstado(EstadoReclamo.RECHAZADO);
        reclamo.setMotivoRechazo(motivo);
        resolver(reclamo, admin);
        reclamoRepository.save(reclamo);
        acreditacionService.registrarResolucionReclamo(reclamo.getOrganizacion(),
                TipoEventoOrganizacion.RECLAMO_RECHAZADO, admin,
                "Reclamo #" + reclamo.getId() + " rechazado: " + motivo);
        actividadService.registrar(Registro.de(TipoActividad.RECLAMO_RECHAZADO)
                .entidad("RECLAMO", reclamo.getId()).detalle(reclamo.getOrganizacion().getNombre())
                .actor(admin).motivo(motivo).cambio(EstadoReclamo.PENDIENTE, EstadoReclamo.RECHAZADO));
    }

    private static void resolver(ReclamoOrganizacion reclamo, Administrador admin) {
        reclamo.setResueltoPor(admin);
        reclamo.setResueltoEn(Instant.now());
    }

    private static void exigirPendiente(ReclamoOrganizacion reclamo) {
        if (reclamo.getEstado() != EstadoReclamo.PENDIENTE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El reclamo ya fue resuelto");
        }
    }

    private ReclamoOrganizacion buscar(Long id) {
        return reclamoRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reclamo no encontrado"));
    }

    private Administrador requireAdministrador(Long userId) {
        Usuario usuario = usuarioRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));
        if (!(usuario instanceof Administrador admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo los administradores pueden resolver reclamos");
        }
        return admin;
    }

    /** Keys must be distinct and live under this claimant's own prefix for this organizacion. */
    private static void validarEvidencias(List<String> keys, Long organizacionId, Long referenteId) {
        Set<String> vistas = new HashSet<>();
        for (String key : keys) {
            Matcher m = OBJECT_KEY_PATTERN.matcher(key);
            if (!m.matches() || !m.group(1).equals(String.valueOf(organizacionId))
                    || !m.group(2).equals(String.valueOf(referenteId)) || !vistas.add(key)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EVIDENCIA_CLAVE_INVALIDA");
            }
        }
    }

    private ReclamoResponse toResponse(ReclamoOrganizacion r, Integer aCargo) {
        Organizacion org = r.getOrganizacion();
        Referente ref = r.getReferente();
        return new ReclamoResponse(
                r.getId(), org.getId(), org.getNombre(), org.getSlug(), org.getDireccion(),
                ref.getId(), ref.getNombre(), ref.getEmail(),
                r.getRol(), r.getTelefono(), r.getMensaje(), List.copyOf(r.getEvidenciaKeys()),
                r.getEstado(), r.getMotivoRechazo(),
                r.getResueltoPor() != null ? r.getResueltoPor().getNombre() : null,
                r.getCreadoEn(), r.getResueltoEn(),
                aCargo, aCargo != null ? OrganizacionService.CAP_ORGANIZACIONES : null);
    }
}
