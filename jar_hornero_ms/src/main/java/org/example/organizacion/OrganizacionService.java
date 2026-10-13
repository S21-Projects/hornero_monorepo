package org.example.organizacion;

import lombok.RequiredArgsConstructor;
import org.example.notificacion.NotificacionEvento;
import org.springframework.context.ApplicationEventPublisher;
import org.example.acreditacion.AcreditacionService;
import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.TipoActividad;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.TipoEventoOrganizacion;
import org.example.organizacion.dto.ActualizarInfoPublicaRequest;
import org.example.organizacion.dto.ActualizarOrganizacionRequest;
import org.example.organizacion.dto.AsignarReferenteRequest;
import org.example.organizacion.dto.CrearOrganizacionRequest;
import org.example.organizacion.dto.OrganizacionResponse;
import org.example.user.Administrador;
import org.example.user.Referente;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrganizacionService {

    private static final int CAP_ORGANIZACIONES = 3;

    private final OrganizacionRepository organizacionRepository;
    private final UsuarioRepository usuarioRepository;
    private final AcreditacionService acreditacionService;
    private final ActividadService actividadService;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public OrganizacionResponse crear(CrearOrganizacionRequest request, Long referenteUserId) {
        Usuario usuario = usuarioRepository.findById(referenteUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));

        if (!(usuario instanceof Referente referente)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo los referentes pueden proponer organizaciones");
        }

        long activas = organizacionRepository.countByReferente_IdAndEstadoNot(referente.getId(), EstadoOrganizacion.RECHAZADA);
        if (activas >= CAP_ORGANIZACIONES) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Alcanzaste el máximo de " + CAP_ORGANIZACIONES + " organizaciones");
        }

        Organizacion organizacion = new Organizacion();
        organizacion.setNombre(request.getNombre());
        organizacion.setSlug(slugUnico(request.getNombre()));
        organizacion.setTipo(request.getTipo());
        organizacion.setDescripcion(request.getDescripcion());
        organizacion.setDireccion(request.getDireccion());
        organizacion.setLatitud(request.getLatitud());
        organizacion.setLongitud(request.getLongitud());
        organizacion.setEstado(EstadoOrganizacion.PENDIENTE);
        organizacion.setReferente(referente);

        // D7: on crear, the 3 info-pública fields write live columns directly —
        // the org is PENDIENTE and invisible publicly until validated, so the
        // existing org-validation gate already covers them.
        if (request.getAceptaDonaciones() != null) organizacion.setAceptaDonaciones(request.getAceptaDonaciones());
        organizacion.setSitioWebUrl(normalizarUrl(request.getSitioWebUrl()));
        organizacion.setDonacionDirectaUrl(normalizarUrl(request.getDonacionDirectaUrl()));

        Organizacion saved = organizacionRepository.save(organizacion);
        acreditacionService.registrarRegistroOrganizacion(saved, referente);
        actividadService.registrar(Registro.de(TipoActividad.ORGANIZACION_CREADA)
                .entidad("ORGANIZACION", saved.getId()).detalle(saved.getNombre()));
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public Page<OrganizacionResponse> listarValidadas(Pageable pageable) {
        return organizacionRepository.findByEstado(EstadoOrganizacion.APROBADA, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<OrganizacionResponse> listarPendientes(Pageable pageable) {
        return organizacionRepository.findByEstado(EstadoOrganizacion.PENDIENTE, pageable)
                .map(this::toResponseAutenticado);
    }

    @Transactional
    public OrganizacionResponse validar(Long orgId, Long adminUserId) {
        Organizacion organizacion = organizacionRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        if (EstadoOrganizacion.APROBADA.equals(organizacion.getEstado())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La organización ya fue validada");
        }

        Usuario usuario = usuarioRepository.findById(adminUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));

        if (!(usuario instanceof Administrador administrador)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo los administradores pueden validar organizaciones");
        }

        // AD-6: delegates to AcreditacionService so this legacy action and the new ladder cannot
        // disagree — nivel, estado/validada and the event log are written by one single method.
        EstadoOrganizacion estadoAntes = organizacion.getEstado();
        acreditacionService.aplicarTransicionLegacy(organizacion, NivelAcreditacion.N1, administrador,
                "Validación administrativa", TipoEventoOrganizacion.NIVEL_ELEVADO);
        organizacion.setValidadoPor(administrador);

        Organizacion saved = organizacionRepository.save(organizacion);
        actividadService.registrar(Registro.de(TipoActividad.ORGANIZACION_VALIDADA)
                .entidad("ORGANIZACION", orgId).cambio(estadoAntes, saved.getEstado()));
        eventPublisher.publishEvent(new NotificacionEvento.OrganizacionResuelta(orgId, true));
        return toResponseAutenticado(saved);
    }

    @Transactional
    public OrganizacionResponse rechazar(Long orgId, Long adminUserId) {
        Organizacion organizacion = organizacionRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        if (!EstadoOrganizacion.PENDIENTE.equals(organizacion.getEstado())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Solo se pueden rechazar organizaciones en estado PENDIENTE");
        }

        Usuario usuario = usuarioRepository.findById(adminUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));
        Administrador administrador = usuario instanceof Administrador a ? a : null;

        // AD-6: never raises nivel (a never-validated org stays N0) — see rechazarRegistro's doc.
        EstadoOrganizacion estadoAntes = organizacion.getEstado();
        acreditacionService.rechazarRegistro(organizacion, administrador, "Registro rechazado por un administrador");

        Organizacion saved = organizacionRepository.save(organizacion);
        actividadService.registrar(Registro.de(TipoActividad.ORGANIZACION_RECHAZADA)
                .entidad("ORGANIZACION", orgId).cambio(estadoAntes, saved.getEstado()));
        eventPublisher.publishEvent(new NotificacionEvento.OrganizacionResuelta(orgId, false));
        return toResponseAutenticado(saved);
    }

    @Transactional(readOnly = true)
    public OrganizacionResponse findBySlugPublic(String slug) {
        return organizacionRepository.findBySlug(slug)
                .filter(o -> EstadoOrganizacion.APROBADA.equals(o.getEstado()))
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));
    }

    @Transactional(readOnly = true)
    public List<OrganizacionResponse> listarPorReferente(Long referenteId) {
        return organizacionRepository.findByReferente_Id(referenteId)
                .stream()
                .map(this::toResponseAutenticado)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrganizacionResponse> listarTodas() {
        return organizacionRepository.findAll()
                .stream()
                .map(this::toResponseAutenticado)
                .collect(Collectors.toList());
    }

    @Transactional
    public OrganizacionResponse asignarReferente(Long orgId, AsignarReferenteRequest request) {
        Organizacion organizacion = organizacionRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        Long referenteAnteriorId = organizacion.getReferente() != null ? organizacion.getReferente().getId() : null;

        Long referenteId = request.getReferenteId();
        if (referenteId == null) {
            organizacion.setReferente(null);
            registrarReasignacion(organizacion, referenteAnteriorId, null);
            return toResponse(organizacionRepository.save(organizacion));
        }

        Usuario usuario = usuarioRepository.findById(referenteId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Referente no encontrado"));

        if (!(usuario instanceof Referente referente)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El usuario indicado no es un referente");
        }

        if (!referente.isActivo()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El referente está inactivo");
        }

        boolean alreadyOwnedByTarget = organizacion.getReferente() != null
                && organizacion.getReferente().getId().equals(referente.getId());
        if (!alreadyOwnedByTarget) {
            long activas = organizacionRepository.countByReferente_IdAndEstadoNot(referente.getId(), EstadoOrganizacion.RECHAZADA);
            if (activas >= CAP_ORGANIZACIONES) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "El referente ya alcanzó el máximo de " + CAP_ORGANIZACIONES + " organizaciones");
            }
        }

        organizacion.setReferente(referente);
        registrarReasignacion(organizacion, referenteAnteriorId, referente.getId());
        return toResponseAutenticado(organizacionRepository.save(organizacion));
    }

    @Transactional(readOnly = true)
    public OrganizacionResponse findBySlug(String slug, Long requestingUserId, String requestingRole) {
        Organizacion org = organizacionRepository.findBySlug(slug)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        boolean isAdmin = "ROLE_ADMINISTRADOR".equals(requestingRole);
        boolean isOwner = org.getReferente() != null && org.getReferente().getId().equals(requestingUserId);

        if (EstadoOrganizacion.APROBADA.equals(org.getEstado())) {
            // D6: pending info-pública fields must not leave the MS on a path an
            // arbitrary authenticated user (e.g. a donante) can reach — only the
            // owning referente or an admin gets the pending snapshot here.
            return (isAdmin || isOwner) ? toResponseAutenticado(org) : toResponse(org);
        }

        if (isAdmin || isOwner) {
            return toResponseAutenticado(org);
        }

        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Acceso denegado");
    }

    @Transactional
    public OrganizacionResponse actualizar(Long orgId, ActualizarOrganizacionRequest request, Long referenteUserId) {
        Organizacion organizacion = organizacionRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        if (organizacion.getReferente() == null || !organizacion.getReferente().getId().equals(referenteUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tenés permiso para editar esta organización");
        }

        List<String> campos = new java.util.ArrayList<>();
        if (request.getNombre() != null) campos.add("nombre");
        if (request.getTipo() != null) campos.add("tipo");
        if (request.getDescripcion() != null) campos.add("descripcion");
        if (request.getDireccion() != null) campos.add("direccion");
        if (request.getLatitud() != null || request.getLongitud() != null) campos.add("coordenadas");
        if (request.getProfileImageKey() != null) campos.add("imagenPerfil");
        if (request.getBannerKey() != null) campos.add("banner");
        if (request.getAceptaDonaciones() != null) campos.add("aceptaDonacionesPendiente");
        if (request.getSitioWebUrl() != null) campos.add("sitioWebPendiente");
        if (request.getDonacionDirectaUrl() != null) campos.add("donacionDirectaPendiente");

        if (request.getNombre() != null) organizacion.setNombre(request.getNombre());
        if (request.getTipo() != null) organizacion.setTipo(request.getTipo());
        if (request.getDescripcion() != null) organizacion.setDescripcion(request.getDescripcion());
        if (request.getDireccion() != null) organizacion.setDireccion(request.getDireccion());
        if (request.getLatitud() != null) organizacion.setLatitud(request.getLatitud());
        if (request.getLongitud() != null) organizacion.setLongitud(request.getLongitud());
        if (request.getProfileImageKey() != null) organizacion.setProfileImageKey(request.getProfileImageKey());
        if (request.getBannerKey() != null) organizacion.setBannerKey(request.getBannerKey());

        // D2/D3: referente writes to the three info-pública fields go through
        // the pending snapshot — the public site keeps rendering the live
        // values until an admin approves. Only touch the snapshot if the
        // request actually carries one of the three fields.
        boolean tocaInfoPublica = request.getAceptaDonaciones() != null
                || request.getSitioWebUrl() != null
                || request.getDonacionDirectaUrl() != null;
        if (tocaInfoPublica) {
            seedPendiente(organizacion);
            if (request.getAceptaDonaciones() != null) {
                organizacion.setAceptaDonacionesPendiente(request.getAceptaDonaciones());
            }
            if (request.getSitioWebUrl() != null) {
                organizacion.setSitioWebUrlPendiente(normalizarUrl(request.getSitioWebUrl()));
            }
            if (request.getDonacionDirectaUrl() != null) {
                organizacion.setDonacionDirectaUrlPendiente(normalizarUrl(request.getDonacionDirectaUrl()));
            }
            organizacion.setInfoPublicaPendienteEn(LocalDateTime.now());
        }

        Organizacion saved = organizacionRepository.save(organizacion);
        // Field NAMES only: the values (urls, keys, address) stay out of the log.
        actividadService.registrar(Registro.de(TipoActividad.ORGANIZACION_ACTUALIZADA)
                .entidad("ORGANIZACION", orgId).detalle("campos: " + String.join(", ", campos)));
        return toResponseAutenticado(saved);
    }

    /**
     * Admin-only: writes the three info-pública fields directly to the live
     * columns and clears any outstanding referente pending submission (D3).
     */
    @Transactional
    public OrganizacionResponse actualizarInfoPublica(Long orgId, ActualizarInfoPublicaRequest request) {
        Organizacion organizacion = organizacionRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        if (request.getAceptaDonaciones() != null) organizacion.setAceptaDonaciones(request.getAceptaDonaciones());
        if (request.getSitioWebUrl() != null) organizacion.setSitioWebUrl(normalizarUrl(request.getSitioWebUrl()));
        if (request.getDonacionDirectaUrl() != null) {
            organizacion.setDonacionDirectaUrl(normalizarUrl(request.getDonacionDirectaUrl()));
        }
        if (request.getProfileImageKey() != null) organizacion.setProfileImageKey(request.getProfileImageKey());
        if (request.getBannerKey() != null) organizacion.setBannerKey(request.getBannerKey());

        limpiarPendiente(organizacion);

        Organizacion saved = organizacionRepository.save(organizacion);
        actividadService.registrar(Registro.de(TipoActividad.ORGANIZACION_INFO_PUBLICA_EDITADA)
                .entidad("ORGANIZACION", orgId));
        return toResponseAutenticado(saved);
    }

    /** Admin-only: copies the pending snapshot onto the live columns. */
    @Transactional
    public OrganizacionResponse aprobarInfoPublica(Long orgId) {
        Organizacion organizacion = organizacionRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        if (organizacion.getInfoPublicaPendienteEn() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No hay cambios pendientes de aprobación");
        }

        organizacion.setAceptaDonaciones(organizacion.getAceptaDonacionesPendiente());
        organizacion.setSitioWebUrl(organizacion.getSitioWebUrlPendiente());
        organizacion.setDonacionDirectaUrl(organizacion.getDonacionDirectaUrlPendiente());

        limpiarPendiente(organizacion);

        Organizacion saved = organizacionRepository.save(organizacion);
        actividadService.registrar(Registro.de(TipoActividad.ORGANIZACION_INFO_PUBLICA_APROBADA)
                .entidad("ORGANIZACION", orgId));
        return toResponseAutenticado(saved);
    }

    /** Admin-only: discards the pending snapshot without touching live values. */
    @Transactional
    public OrganizacionResponse rechazarInfoPublica(Long orgId) {
        Organizacion organizacion = organizacionRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        if (organizacion.getInfoPublicaPendienteEn() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No hay cambios pendientes de aprobación");
        }

        limpiarPendiente(organizacion);

        Organizacion saved = organizacionRepository.save(organizacion);
        actividadService.registrar(Registro.de(TipoActividad.ORGANIZACION_INFO_PUBLICA_RECHAZADA)
                .entidad("ORGANIZACION", orgId));
        return toResponseAutenticado(saved);
    }

    /** Event-log entry (OrganizacionEvento, with the acting admin) plus the activity-log entry. */
    private void registrarReasignacion(Organizacion organizacion, Long antesId, Long despuesId) {
        acreditacionService.registrarReasignacionReferente(organizacion, antesId, despuesId, actorActual());
        actividadService.registrar(Registro.de(TipoActividad.ORGANIZACION_REFERENTE_REASIGNADO)
                .entidad("ORGANIZACION", organizacion.getId())
                .cambio(antesId, despuesId));
    }

    /** The authenticated caller, or {@code null} outside a request (never fabricated). */
    private Usuario actorActual() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Long id) {
            return usuarioRepository.findById(id).orElse(null);
        }
        return null;
    }

    /** D2: seeds the pending trio from the current live state, once per pending cycle. */
    private void seedPendiente(Organizacion o) {
        if (o.getInfoPublicaPendienteEn() == null) {
            o.setAceptaDonacionesPendiente(o.getAceptaDonaciones());
            o.setSitioWebUrlPendiente(o.getSitioWebUrl());
            o.setDonacionDirectaUrlPendiente(o.getDonacionDirectaUrl());
        }
    }

    private void limpiarPendiente(Organizacion o) {
        o.setAceptaDonacionesPendiente(null);
        o.setSitioWebUrlPendiente(null);
        o.setDonacionDirectaUrlPendiente(null);
        o.setInfoPublicaPendienteEn(null);
    }

    /** "" and blank -> NULL (explicit clear sentinel); everything else trimmed. */
    private static String normalizarUrl(String v) {
        return (v == null || v.isBlank()) ? null : v.trim();
    }

    public OrganizacionResponse toResponse(Organizacion organizacion) {
        String referenteNombre = organizacion.getReferente() != null ? organizacion.getReferente().getNombre() : null;
        String referenteEmail = organizacion.getReferente() != null ? organizacion.getReferente().getEmail() : null;
        String validadoPorNombre = organizacion.getValidadoPor() != null ? organizacion.getValidadoPor().getNombre() : null;

        return new OrganizacionResponse(
                organizacion.getId(),
                organizacion.getNombre(),
                organizacion.getSlug(),
                organizacion.getTipo(),
                organizacion.getDescripcion(),
                organizacion.getDireccion(),
                organizacion.getLatitud(),
                organizacion.getLongitud(),
                organizacion.getEstado(),
                referenteNombre,
                referenteEmail,
                validadoPorNombre,
                organizacion.getProfileImageKey(),
                organizacion.getBannerKey(),
                organizacion.getReferente() != null ? organizacion.getReferente().getId() : null,
                // D8/AD-6: additive, coalesced the same way AcreditacionService.nivelActual does —
                // a row the backfill hasn't touched yet (or in tests that never set it) reads N0.
                organizacion.getNivel() == null ? org.example.domain.NivelAcreditacion.N0 : organizacion.getNivel(),
                // D6: public mapper — coalesce the nullable live flag (D4), never leak pending.
                Boolean.TRUE.equals(organizacion.getAceptaDonaciones()),
                organizacion.getSitioWebUrl(),
                organizacion.getDonacionDirectaUrl(),
                null,
                null,
                null,
                null
        );
    }

    /** D6: owner/admin mapper — same live fields, plus the pending snapshot when present. */
    public OrganizacionResponse toResponseAutenticado(Organizacion organizacion) {
        OrganizacionResponse response = toResponse(organizacion);
        response.setAceptaDonacionesPendiente(organizacion.getAceptaDonacionesPendiente());
        response.setSitioWebUrlPendiente(organizacion.getSitioWebUrlPendiente());
        response.setDonacionDirectaUrlPendiente(organizacion.getDonacionDirectaUrlPendiente());
        response.setInfoPublicaPendienteEn(organizacion.getInfoPublicaPendienteEn());
        return response;
    }

    /**
     * Two organizations may legitimately share a name (e.g. in different cities), so a taken slug
     * gets a numeric suffix. A concurrent race still hits the unique constraint, which the global
     * handler answers as 409.
     */
    private String slugUnico(String nombre) {
        String base = generateSlug(nombre);
        if (base == null || !organizacionRepository.existsBySlug(base)) return base;
        int n = 2;
        while (organizacionRepository.existsBySlug(base + "-" + n)) n++;
        return base + "-" + n;
    }

    private String generateSlug(String nombre) {
        if (nombre == null) return null;
        String normalized = Normalizer.normalize(nombre, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "");
        return normalized.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .trim()
                .replaceAll("[\\s]+", "-")
                .replaceAll("-{2,}", "-")
                .replaceAll("^-|-$", "");
    }
}
