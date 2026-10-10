package org.example.acreditacion;

import lombok.RequiredArgsConstructor;
import org.example.acreditacion.dto.AcreditacionResponse;
import org.example.acreditacion.dto.ColaAuditoriaFiltro;
import org.example.acreditacion.dto.EventoResponse;
import org.example.acreditacion.dto.EvidenciaEnColaResponse;
import org.example.acreditacion.dto.EvidenciaResponse;
import org.example.acreditacion.dto.LegajoResponse;
import org.example.acreditacion.dto.RequisitoEnLegajo;
import org.example.acreditacion.dto.TabCola;
import org.example.domain.CategoriaAlimento;
import org.example.domain.EstadoEvidencia;
import org.example.domain.EstadoRequisitoLegajo;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrganizacionEvidencia;
import org.example.domain.OrganizacionEvidenciaRepository;
import org.example.domain.OrganizacionRepository;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEventoOrganizacion;
import org.example.domain.TipoEvidencia;
import org.example.user.Administrador;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Owns the accreditation ladder's transition table (AD-2), the replay-preserving write path
 * (AD-3), evidence submission/audit (AD-4), the requirement-completeness gate on level raises
 * (AD-9) and legajo assembly (AD-11).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AcreditacionService {

    private static final Map<NivelAcreditacion, Set<NivelAcreditacion>> TRANSICIONES_PERMITIDAS =
            new EnumMap<>(NivelAcreditacion.class);

    static {
        TRANSICIONES_PERMITIDAS.put(NivelAcreditacion.N0, EnumSet.of(NivelAcreditacion.N1));
        TRANSICIONES_PERMITIDAS.put(NivelAcreditacion.N1,
                EnumSet.of(NivelAcreditacion.N0, NivelAcreditacion.N2));
        TRANSICIONES_PERMITIDAS.put(NivelAcreditacion.N2,
                EnumSet.of(NivelAcreditacion.N1, NivelAcreditacion.N3));
        TRANSICIONES_PERMITIDAS.put(NivelAcreditacion.N3, EnumSet.of(NivelAcreditacion.N2));
    }

    private final OrganizacionEventoRepository eventoRepository;
    private final OrganizacionEvidenciaRepository evidenciaRepository;
    private final UsuarioRepository usuarioRepository;
    private final OrganizacionRepository organizacionRepository;

    private void validateTransition(NivelAcreditacion actual, NivelAcreditacion siguiente) {
        boolean valid = TRANSICIONES_PERMITIDAS.getOrDefault(actual, Set.of()).contains(siguiente);
        if (!valid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid state transition: " + actual + " -> " + siguiente);
        }
    }

    /** Null-coalescing read: a row not yet touched by {@code AcreditacionBackfill} reads N0. */
    NivelAcreditacion nivelActual(Organizacion org) {
        return org.getNivel() == null ? NivelAcreditacion.N0 : org.getNivel();
    }

    /**
     * AD-6: keeps {@code estado}/{@code validada} as a one-function projection of {@code nivel}
     * so the public contract ({@code findBySlugPublic}, the BFF, Astro) cannot drift as a side
     * effect of a level change. {@code RECHAZADA} is preserved rather than collapsed to
     * {@code PENDIENTE}, because {@code OrganizacionService.crear} counts it to enforce the
     * 3-organizacion cap — collapsing it would silently re-open that cap for rejected orgs.
     */
    void proyectarEstadoLegacy(Organizacion org) {
        boolean acreditada = nivelActual(org).compareTo(NivelAcreditacion.N1) >= 0;
        if (acreditada) {
            org.setEstado(EstadoOrganizacion.APROBADA);
            org.setValidada(true);
        } else if (org.getEstado() != EstadoOrganizacion.RECHAZADA) {
            org.setEstado(EstadoOrganizacion.PENDIENTE);
            org.setValidada(false);
        }
    }

    /**
     * AD-3: the single writer of {@code nivel}. Validates the transition, mutates the entity,
     * re-runs the legacy projection (AD-6) and appends the corresponding event — all inside one
     * {@code @Transactional} unit, so the two cannot diverge. Package-private (not the design
     * snippet's {@code private}) so it is directly testable without reflection; still only
     * reachable from within this package.
     *
     * @param actor {@code null} records a system-originated fact (e.g. the startup backfill,
     *              AD-7), stored as {@code actorTipo = "SISTEMA"}.
     */
    @Transactional
    void aplicarTransicion(Organizacion org, NivelAcreditacion destino, Administrador actor,
                            String motivo, TipoEventoOrganizacion tipo) {
        NivelAcreditacion antes = nivelActual(org);
        validateTransition(antes, destino);
        org.setNivel(destino);
        proyectarEstadoLegacy(org);
        eventoRepository.save(OrganizacionEvento.de(org, tipo, actor, motivo, antes, destino));
    }

    /**
     * Legacy bridge for {@code OrganizacionService.validar()} (AD-6): applies a transition through
     * the SAME single writer as the new ladder ({@link #aplicarTransicion}), deliberately WITHOUT
     * AD-9's requisito-completeness gate — that gate applies only to the new ladder-raising action
     * (`cambiarNivel`). The old admin "validate" button has never required evidence and must keep
     * working exactly as before; what changes is that it now also writes {@code nivel} and an
     * event, so the two paths (old button, new ladder) cannot silently disagree.
     */
    @Transactional
    public void aplicarTransicionLegacy(Organizacion org, NivelAcreditacion destino, Administrador actor,
                                         String motivo, TipoEventoOrganizacion tipo) {
        aplicarTransicion(org, destino, actor, motivo, tipo);
    }

    /**
     * Legacy bridge for {@code OrganizacionService.rechazar()}: a rejection never raises the
     * ladder (a never-validated org stays {@code N0}), so it cannot go through
     * {@link #aplicarTransicion}'s transition table (there is no legal {@code N0 -> N0} self-move).
     * Mirrors {@code AcreditacionBackfill}'s own direct-append pattern for the same reason.
     */
    @Transactional
    public void rechazarRegistro(Organizacion org, Administrador actor, String motivo) {
        org.setEstado(EstadoOrganizacion.RECHAZADA);
        eventoRepository.save(OrganizacionEvento.de(
                org, TipoEventoOrganizacion.REGISTRO_RECHAZADO, actor, motivo, nivelActual(org), null));
    }

    /**
     * `specs/organizacion-evento-log/spec.md` "Registration emits its event":
     * {@code nivelAntes = null, nivelDespues = N0}.
     */
    @Transactional
    public void registrarRegistroOrganizacion(Organizacion org, Usuario actor) {
        eventoRepository.save(OrganizacionEvento.de(
                org, TipoEventoOrganizacion.ORGANIZACION_REGISTRADA, actor,
                "Organización autoregistrada", null, NivelAcreditacion.N0));
    }

    /**
     * `specs/organizacion-evento-log/spec.md` "Reassignment Is a Logged Non-Accreditation Event":
     * appends {@code REFERENTE_REASIGNADO} without touching {@code nivel}/{@code estado}/
     * {@code validada} — this is ownership change, not an accreditation fact. {@code despuesId}
     * {@code null} records an unassignment.
     */
    @Transactional
    public void registrarReasignacionReferente(Organizacion org, Long antesId, Long despuesId, Usuario actor) {
        String motivo = "Referente reasignado: " + antesId + " -> " + despuesId;
        eventoRepository.save(OrganizacionEvento.de(
                org, TipoEventoOrganizacion.REFERENTE_REASIGNADO, actor, motivo, null, null));
    }

    /**
     * `specs/organizacion-evidencia/spec.md` "One Evidence Row Per Requisito Submission" +
     * "Replacement Never Overwrites History": inserts a new {@code PENDIENTE} row and, if a
     * non-{@code REEMPLAZADA} row already exists for the same requisito, marks it
     * {@code REEMPLAZADA} without touching its content — both changes append their own event, in
     * the same transaction.
     */
    @Transactional
    OrganizacionEvidencia cargarEvidencia(Organizacion org, RequisitoAcreditacion requisito,
            TipoEvidencia tipoEvidencia, String declaracion, LocalDate validoDesde,
            LocalDate validoHasta, Long actorUsuarioId) {
        return cargarEvidencia(org, requisito, tipoEvidencia, declaracion, validoDesde, validoHasta,
                actorUsuarioId, null);
    }

    /**
     * Slice B overload: threads {@code objectKey} through to the persisted row for FOTO/DOCUMENTO
     * submissions (Phase 6 defect fix). The trailing-parameter overload keeps every existing
     * positional call site compiling untouched — see {@code OrganizacionEvidencia.nueva}.
     */
    @Transactional
    OrganizacionEvidencia cargarEvidencia(Organizacion org, RequisitoAcreditacion requisito,
            TipoEvidencia tipoEvidencia, String declaracion, LocalDate validoDesde,
            LocalDate validoHasta, Long actorUsuarioId, String objectKey) {
        List<OrganizacionEvidencia> vigentes = evidenciaRepository.findByOrganizacion_IdAndRequisitoAndEstadoNot(
                org.getId(), requisito, EstadoEvidencia.REEMPLAZADA);

        Usuario actor = usuarioRepository.findById(actorUsuarioId).orElse(null);

        OrganizacionEvidencia nueva = evidenciaRepository.save(OrganizacionEvidencia.nueva(
                org, requisito, tipoEvidencia, declaracion, validoDesde, validoHasta, actorUsuarioId, objectKey));
        eventoRepository.save(OrganizacionEvento.deEvidencia(org, TipoEventoOrganizacion.EVIDENCIA_ADJUNTADA,
                actor, "Evidencia cargada para " + requisito, requisito, nueva.getId()));

        for (OrganizacionEvidencia previa : vigentes) {
            previa.setEstado(EstadoEvidencia.REEMPLAZADA);
            evidenciaRepository.save(previa);
            eventoRepository.save(OrganizacionEvento.deEvidencia(org, TipoEventoOrganizacion.EVIDENCIA_REEMPLAZADA,
                    actor, "Reemplazada por una nueva submission para " + requisito, requisito, previa.getId()));
        }

        return nueva;
    }

    /**
     * `specs/organizacion-evidencia/spec.md` "Admin Audit States": only an admin may move a
     * {@code PENDIENTE} row to {@code APROBADA}. The referente-cannot-self-approve rule is
     * enforced here at runtime (defense in depth alongside the controller's role matcher/
     * `@PreAuthorize`), mirroring {@code OrganizacionService.validar}'s
     * {@code instanceof Administrador} check.
     */
    @Transactional
    OrganizacionEvidencia aprobarEvidencia(Long evidenciaId, Long actorUsuarioId) {
        Administrador admin = requireAdministrador(actorUsuarioId);
        OrganizacionEvidencia evidencia = findEvidenciaOrThrow(evidenciaId);

        evidencia.setEstado(EstadoEvidencia.APROBADA);
        evidencia.setRevisadoPor(admin.getId());
        evidencia.setRevisadoEn(java.time.Instant.now());
        OrganizacionEvidencia guardada = evidenciaRepository.save(evidencia);

        eventoRepository.save(OrganizacionEvento.deEvidencia(evidencia.getOrganizacion(),
                TipoEventoOrganizacion.REQUISITO_APROBADO, admin,
                "Evidencia aprobada para " + evidencia.getRequisito(), evidencia.getRequisito(), evidenciaId));

        return guardada;
    }

    /**
     * `specs/organizacion-evidencia/spec.md` "Admin Audit States": the observation reason lands
     * on the accompanying event's {@code motivo}, not just the evidencia row.
     */
    @Transactional
    OrganizacionEvidencia observarEvidencia(Long evidenciaId, String observacion, Long actorUsuarioId) {
        Administrador admin = requireAdministrador(actorUsuarioId);
        OrganizacionEvidencia evidencia = findEvidenciaOrThrow(evidenciaId);

        evidencia.setEstado(EstadoEvidencia.OBSERVADA);
        evidencia.setRevisadoPor(admin.getId());
        evidencia.setRevisadoEn(java.time.Instant.now());
        evidencia.setObservacion(observacion);
        OrganizacionEvidencia guardada = evidenciaRepository.save(evidencia);

        eventoRepository.save(OrganizacionEvento.deEvidencia(evidencia.getOrganizacion(),
                TipoEventoOrganizacion.REQUISITO_OBSERVADO, admin, observacion,
                evidencia.getRequisito(), evidenciaId));

        return guardada;
    }

    private OrganizacionEvidencia findEvidenciaOrThrow(Long evidenciaId) {
        return evidenciaRepository.findById(evidenciaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evidencia no encontrada"));
    }

    private Administrador requireAdministrador(Long actorUsuarioId) {
        Usuario usuario = usuarioRepository.findById(actorUsuarioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));
        if (!(usuario instanceof Administrador administrador)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo un administrador puede auditar evidencia");
        }
        return administrador;
    }

    /**
     * `specs/organizacion-acreditacion/spec.md` "Legal Level Transitions" + AD-9: raising is
     * gated on requisito completeness; lowering only requires a non-blank reason. Both are
     * admin-only actions, enforced here (defense in depth) and by the controller's
     * {@code @PreAuthorize}/matcher.
     */
    @Transactional
    Organizacion cambiarNivel(Long orgId, NivelAcreditacion destino, String motivo, Long actorUsuarioId) {
        Administrador admin = requireAdministrador(actorUsuarioId);
        Organizacion org = organizacionRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        NivelAcreditacion antes = nivelActual(org);
        boolean subiendo = destino.compareTo(antes) > 0;

        if (subiendo) {
            if (!requisitosCompletos(org, destino)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Faltan requisitos aprobados y vigentes para alcanzar " + destino);
            }
            aplicarTransicion(org, destino, admin, motivo, TipoEventoOrganizacion.NIVEL_ELEVADO);
        } else {
            if (motivo == null || motivo.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "motivo is required to lower a level");
            }
            aplicarTransicion(org, destino, admin, motivo, TipoEventoOrganizacion.NIVEL_REDUCIDO);
        }

        return org;
    }

    /**
     * `decisiones-posteriores.md` D-02: backing method for
     * {@code GET /{id}/acreditacion/evidencias}, the admin audit queue. Reuses the existing
     * {@code findByOrganizacion_Id} finder and the pre-existing {@code EvidenciaResponse.from}
     * mapper — no new repository method, no second mapper. {@code filtro == null} returns every
     * row (including {@code REEMPLAZADA} ones, unlike {@link #legajo}, since the queue is an audit
     * trail, not a current-state dossier); an organizacion with no evidence returns an empty list.
     */
    List<EvidenciaResponse> evidencias(Long orgId, EstadoEvidencia filtro) {
        return evidenciaRepository.findByOrganizacion_Id(orgId).stream()
                .filter(e -> filtro == null || e.getEstado() == filtro)
                .map(EvidenciaResponse::from)
                .toList();
    }

    /**
     * AD-8 (tesis-core-features, slice 4a), `specs/auditoria-cola-global/spec.md`: backing method
     * for {@code GET /api/auditoria/evidencias}, the cross-org audit queue. {@code requisito} and
     * {@code nivel} both narrow the {@code requisito IN} set passed to
     * {@link OrganizacionEvidenciaRepository#buscarCola}, which the query always receives
     * non-empty (every {@link RequisitoAcreditacion} when the caller applies neither filter) to
     * avoid a null-collection binding. When both are set, the result is their intersection.
     */
    public Page<EvidenciaEnColaResponse> colaAuditoria(ColaAuditoriaFiltro filtro, Pageable pageable) {
        Set<RequisitoAcreditacion> requisitos = EnumSet.allOf(RequisitoAcreditacion.class);
        if (filtro.nivel() != null) {
            requisitos.retainAll(requisitosPorNivel(filtro.nivel()));
        }
        if (filtro.requisito() != null) {
            requisitos = requisitos.contains(filtro.requisito())
                    ? EnumSet.of(filtro.requisito())
                    : EnumSet.noneOf(RequisitoAcreditacion.class);
        }
        boolean vencidas = filtro.tab() == TabCola.VENCIDAS;

        return evidenciaRepository.buscarCola(vencidas, EstadoEvidencia.PENDIENTE, LocalDate.now(),
                        requisitos, filtro.tipoEvidencia(), pageable)
                .map(EvidenciaEnColaResponse::from);
    }

    private Set<RequisitoAcreditacion> requisitosPorNivel(NivelAcreditacion nivel) {
        Set<RequisitoAcreditacion> matching = EnumSet.noneOf(RequisitoAcreditacion.class);
        for (RequisitoAcreditacion requisito : RequisitoAcreditacion.values()) {
            if (requisito.getNivelExigido() == nivel) {
                matching.add(requisito);
            }
        }
        return matching;
    }

    /**
     * `specs/organizacion-acreditacion/spec.md` "Level-Driven Food Category Caps": the
     * {@link CategoriaAlimento} set an organizacion at {@code nivel} may declare on a
     * {@code necesidad}. Derived from {@link CategoriaAlimento#getNivelMinimo()} rather than a
     * second, separately-maintained per-level mapping, so this and {@code NecesidadService}'s own
     * cap check can never drift apart. N0 permits none, matching "Level-Driven Concurrency Caps"
     * (N0 cannot publish a {@code necesidad} at all).
     */
    public Set<CategoriaAlimento> categoriasPermitidas(NivelAcreditacion nivel) {
        Set<CategoriaAlimento> permitidas = EnumSet.noneOf(CategoriaAlimento.class);
        for (CategoriaAlimento categoria : CategoriaAlimento.values()) {
            if (categoria.getNivelMinimo().compareTo(nivel) <= 0) {
                permitidas.add(categoria);
            }
        }
        return permitidas;
    }

    /** Backing method for {@code GET /{id}/acreditacion}: current level + since-date, no legajo detail. */
    AcreditacionResponse acreditacion(Long orgId) {
        Organizacion org = organizacionRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));
        List<OrganizacionEvento> eventos =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(orgId);
        java.time.Instant nivelDesde = nivelDesdeDe(eventos);
        return new AcreditacionResponse(org.getId(), nivelActual(org), nivelDesde);
    }

    private java.time.Instant nivelDesdeDe(List<OrganizacionEvento> eventosOrdenados) {
        return eventosOrdenados.stream()
                .filter(e -> e.getNivelDespues() != null)
                .reduce((first, second) -> second)
                .map(OrganizacionEvento::getOcurridoEn)
                .orElse(null);
    }

    /**
     * AD-9: every {@link RequisitoAcreditacion} demanded at or below {@code destino} must have a
     * non-expired {@code APROBADA} evidencia. An {@code APROBADA} but expired row blocks a raise
     * (record-and-warn never lowers, but it also never lets a raise happen on stale proof).
     */
    boolean requisitosCompletos(Organizacion org, NivelAcreditacion destino) {
        List<OrganizacionEvidencia> vigentes =
                evidenciaRepository.findByOrganizacion_Id(org.getId());

        for (RequisitoAcreditacion requisito : RequisitoAcreditacion.values()) {
            if (requisito.getNivelExigido().compareTo(destino) > 0) {
                continue;
            }
            boolean cumplido = vigentes.stream()
                    .anyMatch(e -> e.getRequisito() == requisito
                            && e.getEstado() == EstadoEvidencia.APROBADA
                            && !e.isExpirada());
            if (!cumplido) {
                return false;
            }
        }
        return true;
    }

    /**
     * AD-11: assembles the full dossier server-side. Lists every union requisito (even
     * unfulfilled ones, as {@code FALTANTE}) and the full chronological event log.
     */
    LegajoResponse legajo(Long orgId) {
        Organizacion org = organizacionRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organización no encontrada"));

        List<OrganizacionEvento> eventos =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(orgId);

        java.time.Instant nivelDesde = nivelDesdeDe(eventos);

        List<OrganizacionEvidencia> evidenciasVigentes = evidenciaRepository.findByOrganizacion_Id(orgId).stream()
                .filter(e -> e.getEstado() != EstadoEvidencia.REEMPLAZADA)
                .toList();

        List<RequisitoEnLegajo> requisitos = new java.util.ArrayList<>();
        for (RequisitoAcreditacion requisito : RequisitoAcreditacion.values()) {
            OrganizacionEvidencia vigente = evidenciasVigentes.stream()
                    .filter(e -> e.getRequisito() == requisito)
                    .findFirst()
                    .orElse(null);

            if (vigente == null) {
                requisitos.add(new RequisitoEnLegajo(requisito, requisito.getNivelExigido(),
                        EstadoRequisitoLegajo.FALTANTE, null, null, null, null, false, null, null, null));
                continue;
            }

            EstadoRequisitoLegajo estadoLegajo = switch (vigente.getEstado()) {
                case APROBADA -> EstadoRequisitoLegajo.APROBADA;
                case OBSERVADA -> EstadoRequisitoLegajo.OBSERVADA;
                default -> EstadoRequisitoLegajo.PENDIENTE;
            };
            String auditorNombre = vigente.getRevisadoPor() != null
                    ? usuarioRepository.findById(vigente.getRevisadoPor()).map(Usuario::getNombre).orElse(null)
                    : null;

            requisitos.add(new RequisitoEnLegajo(requisito, requisito.getNivelExigido(), estadoLegajo,
                    vigente.getTipoEvidencia(), vigente.getDeclaracion(), vigente.getValidoDesde(),
                    vigente.getValidoHasta(), vigente.isExpirada(), auditorNombre, vigente.getRevisadoEn(),
                    vigente.getObjectKey()));
        }

        List<EventoResponse> eventosResponse = eventos.stream()
                .map(e -> new EventoResponse(e.getTipo(), e.getOcurridoEn(), e.getActorTipo(),
                        e.getActorUsuarioId(), e.getNivelAntes(), e.getNivelDespues(), e.getRequisito(), e.getMotivo()))
                .toList();

        return new LegajoResponse(org.getId(), org.getNombre(), org.getSlug(), org.getDireccion(),
                nivelActual(org), nivelDesde, requisitos, eventosResponse, DISCLOSURE);
    }

    /**
     * AD-12 (tesis-core-features slice 2): the exact per-organizacion object-key shape the SPA's
     * own strict parser (`evidenciaArchivo.ts`) enforces — {@code org-evidencia/{orgId}/{file}}
     * with no further {@code /} (rules out both a deeper path and a {@code ..} segment, since
     * {@code ..} would need to sit as its own segment or trail one, either way introducing a
     * {@code /} the pattern already forbids after the numeric orgId segment).
     */
    private static final Pattern OBJECT_KEY_PATTERN = Pattern.compile("^org-evidencia/(\\d+)/[^/]+$");

    /**
     * Backing method for {@code GET /{id}/acreditacion/evidencias/archivo}: authorizes reading an
     * evidence file by binding it to an existing row (decision 13 — a syntactically valid key with
     * no matching row is still rejected, `EVIDENCIA_NO_ENCONTRADA`). Ownership/role is checked by
     * the controller *before* this call (no existence oracle for a caller who fails that check).
     * {@code REEMPLAZADA} rows still match — the legajo history view can render them.
     */
    void existeArchivoEvidencia(Long organizacionId, String objectKey) {
        Matcher matcher = objectKey == null ? null : OBJECT_KEY_PATTERN.matcher(objectKey);
        boolean clavePertenceAOrg = matcher != null && matcher.matches()
                && matcher.group(1).equals(String.valueOf(organizacionId));
        if (!clavePertenceAOrg) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EVIDENCIA_CLAVE_INVALIDA");
        }
        if (!evidenciaRepository.existsByOrganizacion_IdAndObjectKey(organizacionId, objectKey)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "EVIDENCIA_NO_ENCONTRADA");
        }
    }

    /** Server-owned constant (AD-11): no client can omit or reword this statement. */
    private static final String DISCLOSURE =
            "Este legajo documenta evidencia declarada por la organización y auditada por un "
                    + "administrador. No constituye una verificación del sistema.";
}
