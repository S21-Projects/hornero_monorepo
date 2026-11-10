package org.example.actividad;

import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Writes and queries the activity log (N10/D10).
 *
 * <h3>Transaction semantics (deliberate)</h3>
 * <ul>
 *   <li>{@link #registrar} joins the caller's transaction. Business actions (an admin writes,
 *       a state transition) commit or roll back together with the audit row: no action without
 *       its record and no record of an action that never happened. A failing insert propagates and
 *       aborts the action (fail-closed for admin/business writes).</li>
 *   <li>{@link #registrarAislado} always runs in its own {@code REQUIRES_NEW} transaction and
 *       never throws. It is for events whose business transaction ends in an exception (failed
 *       login, OTP/delivery-code lockout, refresh-token reuse) or has no business transaction at
 *       all (login, logout): those rows must survive the rollback, which is exactly the class of
 *       bug F1 fixed for lockout counters. An audit write failure is logged (sanitized) and the
 *       user action continues: availability of auth must not depend on the audit table.</li>
 * </ul>
 *
 * <p>The client IP is read from the {@code X-Client-IP} header the BFF forwards. The MS is only
 * reachable from the BFF (compose publishes it on 127.0.0.1 only), so the header is trusted; it is
 * still validated as an IP literal before being stored. When absent (jobs, direct calls) it is
 * {@code null}.
 */
@Slf4j
@Service
public class ActividadService {

    public static final String HEADER_IP = "X-Client-IP";

    private final ActividadRepository repository;
    private final Clock clock;
    private final TransactionTemplate nuevaTransaccion;

    public ActividadService(ActividadRepository repository, Clock clock,
                            PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.clock = clock;
        this.nuevaTransaccion = new TransactionTemplate(transactionManager);
        this.nuevaTransaccion.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Same-transaction write; see the class comment. */
    @Transactional
    public void registrar(Registro registro) {
        repository.save(construir(registro));
    }

    /** Own-transaction, never-throwing write; see the class comment. */
    public void registrarAislado(Registro registro) {
        try {
            Actividad fila = construir(registro);
            nuevaTransaccion.executeWithoutResult(status -> repository.save(fila));
        } catch (RuntimeException e) {
            log.error("[actividad] could not record {}: {}", registro.accion,
                    TextoSeguro.limpiar(e.getMessage(), 200));
        }
    }

    @Transactional(readOnly = true)
    public Page<Actividad> buscar(Filtro filtro, Pageable pageable) {
        // Newest first; the caller's sort is ignored so the sort column set stays closed.
        Pageable fijo = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                Sort.by(Sort.Order.desc("ocurridoEn"), Sort.Order.desc("id")));
        Specification<Actividad> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (filtro.actorUsuarioId() != null) p.add(cb.equal(root.get("actorUsuarioId"), filtro.actorUsuarioId()));
            if (filtro.accion() != null) p.add(cb.equal(root.get("accion"), filtro.accion()));
            if (filtro.resultado() != null) p.add(cb.equal(root.get("resultado"), filtro.resultado()));
            if (filtro.entidadTipo() != null && !filtro.entidadTipo().isBlank()) {
                p.add(cb.equal(root.get("entidadTipo"), filtro.entidadTipo().trim().toUpperCase()));
            }
            if (filtro.entidadId() != null) p.add(cb.equal(root.get("entidadId"), filtro.entidadId()));
            if (filtro.desde() != null) p.add(cb.greaterThanOrEqualTo(root.get("ocurridoEn"), filtro.desde()));
            if (filtro.hasta() != null) p.add(cb.lessThanOrEqualTo(root.get("ocurridoEn"), filtro.hasta()));
            return cb.and(p.toArray(new Predicate[0]));
        };
        return repository.findAll(spec, fijo);
    }

    private Actividad construir(Registro r) {
        Long actorId = r.actorId;
        TipoActor actorTipo = r.actorTipo;
        if (r.sistema) {
            actorId = null;
            actorTipo = TipoActor.SISTEMA;
        } else if (actorTipo == null) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof Long id) {
                actorId = id;
                actorTipo = auth.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .filter(a -> a.startsWith("ROLE_"))
                        .map(a -> TipoActor.desdeTipo(a.substring(5)))
                        .findFirst().orElse(TipoActor.ANONIMO);
            } else {
                actorTipo = TipoActor.ANONIMO;
            }
        }
        String email = TextoSeguro.limpiar(r.emailIntento, Actividad.MAX_EMAIL);
        return new Actividad(
                Instant.now(clock),
                actorId,
                actorTipo,
                r.accion,
                r.resultado,
                TextoSeguro.limpiar(r.entidadTipo, Actividad.MAX_ENTIDAD_TIPO),
                r.entidadId,
                TextoSeguro.limpiar(r.detalle, Actividad.MAX_DETALLE),
                TextoSeguro.limpiar(r.antes, Actividad.MAX_VALOR),
                TextoSeguro.limpiar(r.despues, Actividad.MAX_VALOR),
                TextoSeguro.limpiar(r.motivo, Actividad.MAX_MOTIVO),
                ipActual(),
                email == null ? null : email.toLowerCase());
    }

    private static String ipActual() {
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        if (attrs instanceof ServletRequestAttributes servlet) {
            HttpServletRequest request = servlet.getRequest();
            return TextoSeguro.ipONull(request.getHeader(HEADER_IP));
        }
        return null;
    }

    public record Filtro(Long actorUsuarioId, TipoActividad accion, ResultadoActividad resultado,
                         String entidadTipo, Long entidadId, Instant desde, Instant hasta) {
    }

    /** Fluent description of one event. Build with {@link #de}, hand to a {@code registrar*} method. */
    public static final class Registro {
        final TipoActividad accion;
        ResultadoActividad resultado = ResultadoActividad.EXITO;
        Long actorId;
        TipoActor actorTipo;
        boolean sistema;
        String entidadTipo;
        Long entidadId;
        String detalle;
        String antes;
        String despues;
        String motivo;
        String emailIntento;

        private Registro(TipoActividad accion) {
            this.accion = accion;
        }

        public static Registro de(TipoActividad accion) {
            return new Registro(accion);
        }

        public Registro fallo() {
            this.resultado = ResultadoActividad.FALLO;
            return this;
        }

        /** Explicit actor, for flows where the SecurityContext is not populated (login, OTP). */
        public Registro actor(Long usuarioId, String tipo) {
            this.actorId = usuarioId;
            this.actorTipo = TipoActor.desdeTipo(tipo);
            return this;
        }

        /** Explicit actor from an entity (JWT-discriminator style type). */
        public Registro actor(org.example.user.Usuario usuario) {
            if (usuario == null) {
                return this;
            }
            this.actorId = usuario.getId();
            jakarta.persistence.DiscriminatorValue d =
                    usuario.getClass().getAnnotation(jakarta.persistence.DiscriminatorValue.class);
            this.actorTipo = TipoActor.desdeTipo(d != null ? d.value() : usuario.getClass().getSimpleName());
            return this;
        }

        /** Marks a scheduled/startup task. */
        public Registro sistema() {
            this.sistema = true;
            return this;
        }

        public Registro entidad(String tipo, Long id) {
            this.entidadTipo = tipo;
            this.entidadId = id;
            return this;
        }

        public Registro detalle(String detalle) {
            this.detalle = detalle;
            return this;
        }

        public Registro cambio(Object antes, Object despues) {
            this.antes = antes == null ? null : String.valueOf(antes);
            this.despues = despues == null ? null : String.valueOf(despues);
            return this;
        }

        public Registro motivo(String motivo) {
            this.motivo = motivo;
            return this;
        }

        /** Failed logins only (see {@link Actividad}). */
        public Registro emailIntento(String email) {
            this.emailIntento = email;
            return this;
        }

        public TipoActividad accion() { return accion; }
        public ResultadoActividad resultado() { return resultado; }
        public Long actorId() { return actorId; }
        public TipoActor actorTipo() { return actorTipo; }
        public boolean esSistema() { return sistema; }
        public String entidadTipo() { return entidadTipo; }
        public Long entidadId() { return entidadId; }
        public String detalle() { return detalle; }
        public String antes() { return antes; }
        public String despues() { return despues; }
        public String motivo() { return motivo; }
        public String emailIntento() { return emailIntento; }
    }
}
