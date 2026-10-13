package org.example.necesidad;

import lombok.RequiredArgsConstructor;
import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.TipoActividad;
import org.example.auth.VerificacionService;
import org.example.config.AcreditacionProperties;
import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.EstadoNecesidad;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadArticulo;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.necesidad.dto.ActualizarNecesidadRequest;
import org.example.necesidad.dto.CrearNecesidadRequest;
import org.example.necesidad.dto.RelanzarNecesidadRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NecesidadService {

    private static final Set<EstadoNecesidad> ESTADOS_ABIERTOS =
            Set.of(EstadoNecesidad.ABIERTA, EstadoNecesidad.EN_PROGRESO);

    private final NecesidadRepository necesidadRepository;
    private final OrganizacionRepository organizacionRepository;
    private final VerificacionService verificacionService;
    private final AcreditacionProperties acreditacionProperties;
    private final ArticuloRepository articuloRepository;
    private final Clock clock;
    private final ActividadService actividadService;

    @Transactional
    public NecesidadResponse crear(CrearNecesidadRequest dto, Long referenteId) {
        verificacionService.requireVerified(referenteId);

        // Feature catalogo-articulos, decision 6: a necesidad MUST declare at least one articulo
        // now — cheap shape check before any repository lookup, mirroring DonacionService's
        // "reject a malformed request cheaply" convention.
        if (dto.getArticuloIds() == null || dto.getArticuloIds().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Necesidad requires at least one articulo");
        }

        // D2/N4: a past expiry date would be expired by the daily job right away.
        if (dto.getFechaVencimiento() != null && dto.getFechaVencimiento().isBefore(hoy())) {
            throw fechaPasada();
        }

        Organizacion org = organizacionRepository.findByIdAndReferente_Id(dto.getOrganizacionId(), referenteId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Access denied: not the referente of this organization"));

        // `specs/organizacion-acreditacion/spec.md` "Level-Driven Concurrency Caps".
        NivelAcreditacion nivel = org.getNivel() == null ? NivelAcreditacion.N0 : org.getNivel();
        verificarCupo(org, nivel);

        Necesidad necesidad = new Necesidad();
        necesidad.setDescripcion(dto.getDescripcion());
        necesidad.setPrioridad(dto.getPrioridad());
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setFechaPublicacion(hoy());
        necesidad.setFechaVencimiento(dto.getFechaVencimiento());
        necesidad.setOrganizacion(org);

        // Decision 6: categoria is always derived from the selected articulos, never
        // hand-entered — reject any selection referencing an unknown or deactivated articulo
        // (decision 3: a deactivated articulo must no longer be selectable, but existing
        // references to it keep resolving).
        List<NecesidadArticulo> articulos = resolverArticulos(dto.getArticuloIds(), necesidad);
        CategoriaAlimento categoria = CategoriaAlimento.masExigente(
                articulos.stream().map(na -> na.getArticulo().getCategoria()).collect(Collectors.toList()));

        // `specs/organizacion-acreditacion/spec.md` "Level-Driven Food Category Caps".
        if (categoria.getNivelMinimo().compareTo(nivel) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "La categoría " + categoria + " requiere el nivel " + categoria.getNivelMinimo()
                            + " o superior");
        }

        necesidad.setArticulos(articulos);
        necesidad.setCategoria(categoria);

        Necesidad guardada = necesidadRepository.save(necesidad);
        actividadService.registrar(Registro.de(TipoActividad.NECESIDAD_CREADA)
                .entidad("NECESIDAD", guardada.getId()).detalle("organización " + org.getId()));
        return toResponse(guardada);
    }

    public Page<NecesidadResponse> findByOrganizacion(Long organizacionId, Pageable pageable) {
        // D2/N4: expired necesidades are taken down publicly; only the owning referente and
        // admins still see them (the referente needs them to relaunch).
        if (puedeVerVencidas(organizacionId)) {
            return necesidadRepository.findByOrganizacion_Id(organizacionId, pageable).map(this::toResponse);
        }
        // M3: an organization at N0 (or without level) is not publicly listed.
        boolean n0 = organizacionRepository.findById(organizacionId)
                .map(o -> o.getNivel() == null || o.getNivel() == NivelAcreditacion.N0)
                .orElse(false);
        if (n0) {
            return Page.empty(pageable);
        }
        return necesidadRepository.findByOrganizacion_IdAndEstadoNot(
                organizacionId, EstadoNecesidad.VENCIDA, pageable).map(this::toResponse);
    }

    public Page<NecesidadResponse> findAll(Pageable pageable) {
        // M3: N0 organizations are hidden except from their own referente; admins see everything
        // that is not expired.
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (esAdmin(auth)) {
            return necesidadRepository.findByEstadoNot(EstadoNecesidad.VENCIDA, pageable)
                    .map(this::toResponse);
        }
        Long userId = auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof Long id ? id : null;
        return necesidadRepository.findPublicas(userId, pageable).map(this::toResponse);
    }

    public NecesidadResponse findById(Long id) {
        Necesidad n = necesidadRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Necesidad not found"));
        // N17 (closes the M3 gap): a necesidad of an organization at N0 (or without level) is
        // hidden from everyone but its owning referente and admins. 404, not 403, so its
        // existence is not revealed. Expired (VENCIDA) detail stays readable (N4 decision).
        Organizacion org = n.getOrganizacion();
        boolean n0 = org != null && (org.getNivel() == null || org.getNivel() == NivelAcreditacion.N0);
        if (n0 && !puedeVerVencidas(org.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Necesidad not found");
        }
        return toResponse(n);
    }

    @Transactional
    public NecesidadResponse actualizar(Long id, ActualizarNecesidadRequest dto, Long referenteId) {
        Necesidad n = necesidadRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Necesidad not found"));
        checkOwnership(n, referenteId);
        EstadoNecesidad estadoAntes = n.getEstado();
        if (dto.getDescripcion() != null) n.setDescripcion(dto.getDescripcion());
        if (dto.getPrioridad() != null) n.setPrioridad(dto.getPrioridad());
        // D2/N4: leaving VENCIDA goes through relanzar (date + cap checks); an open necesidad
        // can't carry a past date (the daily job would expire it again).
        if (n.getEstado() == EstadoNecesidad.VENCIDA
                && dto.getEstado() != null && dto.getEstado() != EstadoNecesidad.VENCIDA) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "NECESIDAD_VENCIDA_USAR_RELANZAR: una necesidad vencida solo se reabre relanzándola");
        }
        // M4: reopening (CUMPLIDA -> ABIERTA/EN_PROGRESO) takes a slot like crear/relanzar. Checked
        // before the in-memory change so the count query's auto-flush doesn't count this row.
        if (dto.getEstado() != null && ESTADOS_ABIERTOS.contains(dto.getEstado())
                && !ESTADOS_ABIERTOS.contains(n.getEstado())) {
            Organizacion org = n.getOrganizacion();
            verificarCupo(org, org.getNivel() == null ? NivelAcreditacion.N0 : org.getNivel());
        }
        if (dto.getEstado() != null) n.setEstado(dto.getEstado());
        if (dto.getFechaVencimiento() != null) n.setFechaVencimiento(dto.getFechaVencimiento());
        if ((dto.getEstado() != null || dto.getFechaVencimiento() != null)
                && ESTADOS_ABIERTOS.contains(n.getEstado())
                && n.getFechaVencimiento() != null && n.getFechaVencimiento().isBefore(hoy())) {
            throw fechaPasada();
        }
        if (dto.getArticuloIds() != null) {
            if (dto.getArticuloIds().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Necesidad requires at least one articulo");
            }
            List<NecesidadArticulo> nuevos = resolverArticulos(dto.getArticuloIds(), n);
            n.getArticulos().clear();
            n.getArticulos().addAll(nuevos);
            n.setCategoria(CategoriaAlimento.masExigente(
                    nuevos.stream().map(na -> na.getArticulo().getCategoria()).collect(Collectors.toList())));
        }
        Necesidad guardada = necesidadRepository.save(n);
        actividadService.registrar(Registro.de(TipoActividad.NECESIDAD_ACTUALIZADA)
                .entidad("NECESIDAD", id).cambio(estadoAntes, guardada.getEstado()));
        return toResponse(guardada);
    }

    /**
     * D2/N4: reopens an expired necesidad with a new expiry date. Counts against the level cap like
     * a new publication and is stamped as published today.
     */
    @Transactional
    public NecesidadResponse relanzar(Long id, RelanzarNecesidadRequest dto, Long referenteId) {
        Necesidad n = necesidadRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Necesidad not found"));
        checkOwnership(n, referenteId);
        if (n.getEstado() != EstadoNecesidad.VENCIDA) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "NECESIDAD_NO_VENCIDA: solo se puede relanzar una necesidad vencida");
        }
        LocalDate hoy = hoy();
        if (!dto.getFechaVencimiento().isAfter(hoy)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "FECHA_VENCIMIENTO_PASADA: la nueva fecha de vencimiento debe ser posterior a hoy");
        }
        Organizacion org = n.getOrganizacion();
        NivelAcreditacion nivel = org.getNivel() == null ? NivelAcreditacion.N0 : org.getNivel();
        verificarCupo(org, nivel);
        if (n.getCategoria() != null && n.getCategoria().getNivelMinimo().compareTo(nivel) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "La categoría " + n.getCategoria() + " requiere el nivel " + n.getCategoria().getNivelMinimo()
                            + " o superior");
        }
        EstadoNecesidad estadoAntes = n.getEstado();
        n.setEstado(EstadoNecesidad.ABIERTA);
        n.setFechaVencimiento(dto.getFechaVencimiento());
        n.setFechaPublicacion(hoy);
        Necesidad guardada = necesidadRepository.save(n);
        actividadService.registrar(Registro.de(TipoActividad.NECESIDAD_RELANZADA)
                .entidad("NECESIDAD", id).cambio(estadoAntes, EstadoNecesidad.ABIERTA)
                .detalle("nuevo vencimiento " + dto.getFechaVencimiento()));
        return toResponse(guardada);
    }

    @Transactional
    public void eliminar(Long id, Long referenteId) {
        Necesidad n = necesidadRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Necesidad not found"));
        checkOwnership(n, referenteId);
        necesidadRepository.delete(n);
        actividadService.registrar(Registro.de(TipoActividad.NECESIDAD_ELIMINADA)
                .entidad("NECESIDAD", id).cambio(n.getEstado(), null));
    }

    private LocalDate hoy() {
        return LocalDate.now(clock);
    }

    private static ResponseStatusException fechaPasada() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "FECHA_VENCIMIENTO_PASADA: la fecha de vencimiento no puede ser anterior a hoy");
    }

    /** `specs/organizacion-acreditacion/spec.md` "Level-Driven Concurrency Caps". */
    private void verificarCupo(Organizacion org, NivelAcreditacion nivel) {
        long cap = acreditacionProperties.capPara(nivel);
        long abiertas = necesidadRepository.countByOrganizacion_IdAndEstadoIn(org.getId(), ESTADOS_ABIERTOS);
        if (abiertas >= cap) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Alcanzaste el máximo de " + cap + " necesidades abiertas para el nivel " + nivel);
        }
    }

    /** Admins and the referente owning {@code organizacionId} may list its expired necesidades. */
    private boolean puedeVerVencidas(Long organizacionId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof Long userId)) {
            return false;
        }
        if (esAdmin(auth)) {
            return true;
        }
        return organizacionRepository.findByIdAndReferente_Id(organizacionId, userId).isPresent();
    }

    private static boolean esAdmin(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return false;
        }
        for (GrantedAuthority a : auth.getAuthorities()) {
            if ("ROLE_ADMINISTRADOR".equals(a.getAuthority())) {
                return true;
            }
        }
        return false;
    }

    private void checkOwnership(Necesidad n, Long referenteId) {
        var referente = n.getOrganizacion().getReferente();
        if (referente == null || !referente.getId().equals(referenteId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Access denied: not the referente of this organization");
        }
    }

    private List<NecesidadArticulo> resolverArticulos(List<Long> articuloIds, Necesidad necesidad) {
        List<NecesidadArticulo> resultado = new ArrayList<>();
        for (Long articuloId : articuloIds) {
            Articulo articulo = articuloRepository.findById(articuloId)
                    .filter(Articulo::isActivo)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Articulo inválido o inactivo: " + articuloId));
            NecesidadArticulo na = new NecesidadArticulo();
            na.setArticulo(articulo);
            na.setNecesidad(necesidad);
            resultado.add(na);
        }
        return resultado;
    }

    NecesidadResponse toResponse(Necesidad n) {
        return new NecesidadResponse(
                n.getId(),
                n.getDescripcion(),
                n.getPrioridad().name(),
                n.getEstado().name(),
                n.getFechaPublicacion(),
                n.getFechaVencimiento(),
                n.getOrganizacion().getId(),
                n.getCategoria(),
                n.getArticulos().stream()
                        .map(na -> new NecesidadArticuloResponse(
                                na.getArticulo().getId(),
                                na.getArticulo().getNombre(),
                                na.getArticulo().getUnidad() != null ? na.getArticulo().getUnidad().name() : null,
                                na.getArticulo().getCategoria() != null ? na.getArticulo().getCategoria().name() : null))
                        .collect(Collectors.toList())
        );
    }
}
