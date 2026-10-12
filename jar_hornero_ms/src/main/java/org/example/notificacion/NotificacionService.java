package org.example.notificacion;

import lombok.extern.slf4j.Slf4j;
import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.TipoActividad;
import org.example.domain.Donacion;
import org.example.domain.DonacionLinea;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.donacion.EstancamientoDonacion;
import org.example.donacion.VentanasDonacion;
import org.example.mail.Mailer;
import org.example.mail.MailerConfig;
import org.example.mail.MensajeCorreo;
import org.example.mail.NotificacionesEmailTemplates;
import org.example.notificacion.NotificacionEvento.*;
import org.example.user.Administrador;
import org.example.user.Referente;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * N13/D6: turns a committed {@link NotificacionEvento} (or the daily digest) into emails and sends
 * them. Meant to be called off the request thread ({@link NotificacionListener}, the digest job).
 *
 * <ul>
 *   <li><b>Read, then send.</b> Data is read in a short read-only transaction and every message is
 *       rendered there; the sends happen after it closes, so a slow provider never holds a
 *       connection.</li>
 *   <li><b>Recipients.</b> Only active users with a verified email: an inactive user must not hear
 *       from the platform, and an unverified address may be mistyped or belong to someone else, so
 *       sending it donation or organization details would leak them.</li>
 *   <li><b>Failures.</b> Never thrown to the caller and never retried. Each failed send (or failed
 *       build) is written to the activity log with the template name and the MASKED recipient; the
 *       provider's exception message is deliberately not stored (it can echo keys or addresses).
 *       Successful sends are not recorded: they would dominate the log's volume without audit value;
 *       they only leave a debug line with the masked recipient.</li>
 *   <li><b>Kill switch.</b> {@code app.notificaciones.enabled=false} turns everything off.</li>
 * </ul>
 */
@Slf4j
@Service
public class NotificacionService {

    private static final int MAX_LINEAS = 20;

    private final DonacionRepository donacionRepository;
    private final OrganizacionRepository organizacionRepository;
    private final UsuarioRepository usuarioRepository;
    private final Mailer mailer;
    private final ActividadService actividadService;
    private final TransactionTemplate lectura;
    private final Clock clock;
    private final VentanasDonacion ventanas;
    private final boolean habilitado;
    private final String panelUrl;

    public NotificacionService(DonacionRepository donacionRepository,
                               OrganizacionRepository organizacionRepository,
                               UsuarioRepository usuarioRepository,
                               Mailer mailer,
                               ActividadService actividadService,
                               PlatformTransactionManager transactionManager,
                               Clock clock,
                               VentanasDonacion ventanas,
                               @Value("${app.notificaciones.enabled:true}") boolean habilitado,
                               @Value("${app.panel-url:http://localhost:5173}") String panelUrl) {
        this.donacionRepository = donacionRepository;
        this.organizacionRepository = organizacionRepository;
        this.usuarioRepository = usuarioRepository;
        this.mailer = mailer;
        this.actividadService = actividadService;
        this.lectura = new TransactionTemplate(transactionManager);
        this.lectura.setReadOnly(true);
        // New transaction even when called inline from an AFTER_COMMIT callback, where the
        // committed one is still bound to the thread.
        this.lectura.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.clock = clock;
        this.ventanas = ventanas;
        this.habilitado = habilitado;
        this.panelUrl = panelUrl.endsWith("/") ? panelUrl.substring(0, panelUrl.length() - 1) : panelUrl;
    }

    public boolean habilitado() {
        return habilitado;
    }

    /** Handles one committed event. Never throws. */
    public void procesar(NotificacionEvento evento) {
        if (!habilitado) {
            return;
        }
        List<Envio> envios;
        try {
            envios = lectura.execute(status -> construir(evento));
        } catch (RuntimeException e) {
            registrarFallo(evento.getClass().getSimpleName(), null, null, null, e);
            return;
        }
        enviar(envios);
    }

    /** Daily digest for every active, verified admin; nothing is sent when nothing is pending. */
    public void enviarDigest() {
        if (!habilitado) {
            return;
        }
        List<Envio> envios;
        try {
            envios = lectura.execute(status -> construirDigest());
        } catch (RuntimeException e) {
            registrarFallo("digest-admin", null, null, null, e);
            return;
        }
        enviar(envios);
    }

    // --- sending -----------------------------------------------------------------------------------

    private void enviar(List<Envio> envios) {
        if (envios == null) {
            return;
        }
        for (Envio envio : envios) {
            try {
                mailer.enviar(envio.mensaje());
                log.debug("[notificacion] {} enviada a {}", envio.plantilla(), MailerConfig.enmascarar(envio.mensaje().to()));
            } catch (RuntimeException e) {
                registrarFallo(envio.plantilla(), envio.mensaje().to(), envio.entidadTipo(), envio.entidadId(), e);
            }
        }
    }

    private void registrarFallo(String plantilla, String destinatario, String entidadTipo, Long entidadId,
                                RuntimeException e) {
        String detalle = "plantilla " + plantilla
                + (destinatario != null ? ", destinatario " + MailerConfig.enmascarar(destinatario) : "")
                + ", " + e.getClass().getSimpleName();
        log.warn("[notificacion] {}", detalle);
        try {
            Registro registro = Registro.de(TipoActividad.NOTIFICACION_FALLIDA).sistema().fallo().detalle(detalle);
            if (entidadTipo != null) {
                registro.entidad(entidadTipo, entidadId);
            }
            actividadService.registrarAislado(registro);
        } catch (RuntimeException ignorada) {
            // registrarAislado never throws; this only guards a mocked/replaced implementation.
            log.warn("[notificacion] no se pudo registrar el fallo de {}", plantilla);
        }
    }

    // --- composition (runs inside the read transaction) --------------------------------------------

    private List<Envio> construir(NotificacionEvento evento) {
        if (evento instanceof DonacionOfrecida e) {
            return ofrecida(e);
        } else if (evento instanceof DonacionDecidida e) {
            return decidida(e);
        } else if (evento instanceof DonacionVencida e) {
            return vencida(e);
        } else if (evento instanceof EntregaConfirmada e) {
            return entregada(e);
        } else if (evento instanceof PropuestasAsignadas e) {
            return propuestas(e);
        } else if (evento instanceof OrganizacionResuelta e) {
            return organizacionResuelta(e);
        } else if (evento instanceof NivelAcreditacionCambiado e) {
            return nivelCambiado(e);
        } else if (evento instanceof EvidenciaObservada e) {
            return evidenciaObservada(e);
        }
        throw new IllegalArgumentException("unhandled event " + evento.getClass().getSimpleName());
    }

    private List<Envio> ofrecida(DonacionOfrecida e) {
        Donacion d = donacion(e.donacionId());
        Organizacion org = d.getNecesidad().getOrganizacion();
        Usuario ref = org.getReferente();
        if (!notificable(ref)) {
            return List.of();
        }
        return List.of(new Envio("oferta-recibida", NotificacionesEmailTemplates.ofertaRecibida(ref.getEmail(),
                ref.getNombre(), org.getNombre(), d.getDonante().getNombre(), articulos(d), panelUrl + "/dashboard"),
                "DONACION", d.getId()));
    }

    private List<Envio> decidida(DonacionDecidida e) {
        Donacion d = donacion(e.donacionId());
        if (!notificable(d.getDonante())) {
            return List.of();
        }
        String to = d.getDonante().getEmail();
        String nombre = d.getDonante().getNombre();
        String enlace = enlaceDonacion(d);
        return e.aceptada()
                ? List.of(new Envio("donacion-aceptada", NotificacionesEmailTemplates.donacionAceptada(to, nombre,
                        nombreOrg(d), articulos(d), enlace), "DONACION", d.getId()))
                : List.of(new Envio("donacion-rechazada", NotificacionesEmailTemplates.donacionRechazada(to, nombre,
                        nombreOrg(d), enlace), "DONACION", d.getId()));
    }

    private List<Envio> vencida(DonacionVencida e) {
        Donacion d = donacion(e.donacionId());
        if (!notificable(d.getDonante())) {
            return List.of();
        }
        return List.of(new Envio("donacion-vencida", NotificacionesEmailTemplates.donacionVencida(
                d.getDonante().getEmail(), d.getDonante().getNombre(), nombreOrg(d),
                ventanas.ofertaSinRespuestaDias(), enlaceDonacion(d)), "DONACION", d.getId()));
    }

    private List<Envio> entregada(EntregaConfirmada e) {
        Donacion d = donacion(e.donacionId());
        if (!notificable(d.getDonante())) {
            return List.of();
        }
        return List.of(new Envio("entrega-confirmada", NotificacionesEmailTemplates.entregaConfirmada(
                d.getDonante().getEmail(), d.getDonante().getNombre(), nombreOrg(d), enlaceDonacion(d)),
                "DONACION", d.getId()));
    }

    /** One email per referente: their organizations with how many donations each was proposed. */
    private List<Envio> propuestas(PropuestasAsignadas e) {
        record Grupo(Referente referente, Map<String, Integer> porOrganizacion) {
        }
        Map<Long, Grupo> porReferente = new LinkedHashMap<>();
        for (Long donacionId : e.donacionIds()) {
            Donacion d = donacionRepository.findByIdWithRelations(donacionId).orElse(null);
            if (d == null || d.getNecesidad() == null || d.getNecesidad().getOrganizacion() == null) {
                continue;
            }
            Organizacion org = d.getNecesidad().getOrganizacion();
            Referente ref = org.getReferente();
            if (!notificable(ref)) {
                continue;
            }
            porReferente.computeIfAbsent(ref.getId(), id -> new Grupo(ref, new LinkedHashMap<>()))
                    .porOrganizacion().merge(org.getNombre(), 1, Integer::sum);
        }
        List<Envio> envios = new ArrayList<>();
        for (Grupo g : porReferente.values()) {
            int total = g.porOrganizacion().values().stream().mapToInt(Integer::intValue).sum();
            List<String> lineas = g.porOrganizacion().entrySet().stream()
                    .map(en -> en.getKey() + ": " + en.getValue() + (en.getValue() == 1 ? " donación" : " donaciones"))
                    .toList();
            envios.add(new Envio("propuestas-ronda", NotificacionesEmailTemplates.propuestasRonda(
                    g.referente().getEmail(), g.referente().getNombre(), total, lineas, panelUrl + "/dashboard"),
                    "USUARIO", g.referente().getId()));
        }
        return envios;
    }

    private List<Envio> organizacionResuelta(OrganizacionResuelta e) {
        Organizacion org = organizacion(e.organizacionId());
        Usuario ref = org.getReferente();
        if (!notificable(ref)) {
            return List.of();
        }
        String enlace = panelUrl + "/mis-organizaciones";
        return e.aprobada()
                ? List.of(new Envio("organizacion-aprobada", NotificacionesEmailTemplates.organizacionAprobada(
                        ref.getEmail(), ref.getNombre(), org.getNombre(), enlace), "ORGANIZACION", org.getId()))
                : List.of(new Envio("organizacion-rechazada", NotificacionesEmailTemplates.organizacionRechazada(
                        ref.getEmail(), ref.getNombre(), org.getNombre(), enlace), "ORGANIZACION", org.getId()));
    }

    private List<Envio> nivelCambiado(NivelAcreditacionCambiado e) {
        Organizacion org = organizacion(e.organizacionId());
        Usuario ref = org.getReferente();
        if (!notificable(ref)) {
            return List.of();
        }
        return List.of(new Envio("nivel-cambiado", NotificacionesEmailTemplates.nivelCambiado(ref.getEmail(),
                ref.getNombre(), org.getNombre(), e.antes(), e.despues(), e.motivo(), panelUrl + "/acreditacion"),
                "ORGANIZACION", org.getId()));
    }

    private List<Envio> evidenciaObservada(EvidenciaObservada e) {
        Organizacion org = organizacion(e.organizacionId());
        Usuario ref = org.getReferente();
        if (!notificable(ref)) {
            return List.of();
        }
        return List.of(new Envio("evidencia-observada", NotificacionesEmailTemplates.evidenciaObservada(
                ref.getEmail(), ref.getNombre(), org.getNombre(), e.requisito(), e.observacion(),
                panelUrl + "/acreditacion"), "ORGANIZACION", org.getId()));
    }

    private List<Envio> construirDigest() {
        Page<Organizacion> pendientes = organizacionRepository.findByEstado(EstadoOrganizacion.PENDIENTE,
                PageRequest.of(0, MAX_LINEAS, Sort.by("id")));
        Instant ahora = clock.instant();
        Instant corteEnCurso = ahora.minus(ventanas.enCursoEstancada());
        Instant corteConfirmacion = ahora.minus(ventanas.confirmacionEstancada());
        Page<Donacion> estancadas = donacionRepository.findActivas(EstadoDonacion.NO_TERMINALES, "", true,
                corteEnCurso, Donacion.fechaLimiteFallback(corteEnCurso, clock.getZone()),
                corteConfirmacion, Donacion.fechaLimiteFallback(corteConfirmacion, clock.getZone()),
                PageRequest.of(0, MAX_LINEAS, Sort.by("estadoDesde")));
        int totalOrgs = (int) pendientes.getTotalElements();
        int totalEstancadas = (int) estancadas.getTotalElements();
        if (totalOrgs + totalEstancadas == 0) {
            return List.of();
        }
        List<String> lineasOrgs = pendientes.getContent().stream().map(Organizacion::getNombre).toList();
        List<String> lineasDonaciones = estancadas.getContent().stream()
                .map(d -> "Donación #" + d.getId() + " · " + nombreOrg(d) + " · "
                        + EstancamientoDonacion.diasEnEstado(d, ahora, clock.getZone()) + " días en "
                        + d.getEstado().name().toLowerCase().replace('_', ' '))
                .toList();
        List<Envio> envios = new ArrayList<>();
        for (Administrador admin : usuarioRepository.findAdministradoresActivos()) {
            if (!notificable(admin)) {
                continue;
            }
            envios.add(new Envio("digest-admin", NotificacionesEmailTemplates.digestAdmin(admin.getEmail(),
                    admin.getNombre(), totalOrgs, lineasOrgs, totalEstancadas, lineasDonaciones,
                    panelUrl + "/admin", panelUrl + "/control-donaciones"), "USUARIO", admin.getId()));
        }
        return envios;
    }

    // --- helpers -----------------------------------------------------------------------------------

    private static boolean notificable(Usuario u) {
        return u != null && u.isActivo() && u.isEmailVerificado() && u.getEmail() != null && !u.getEmail().isBlank();
    }

    private Donacion donacion(Long id) {
        return donacionRepository.findByIdWithRelations(id)
                .orElseThrow(() -> new IllegalStateException("donacion " + id + " not found"));
    }

    private Organizacion organizacion(Long id) {
        return organizacionRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("organizacion " + id + " not found"));
    }

    private static String nombreOrg(Donacion d) {
        return d.getNecesidad() != null && d.getNecesidad().getOrganizacion() != null
                ? d.getNecesidad().getOrganizacion().getNombre() : "la organización";
    }

    private String enlaceDonacion(Donacion d) {
        return panelUrl + "/mis-donaciones/" + d.getId();
    }

    private static List<String> articulos(Donacion d) {
        List<String> lineas = new ArrayList<>();
        for (DonacionLinea l : d.getLineas()) {
            String unidad = l.getArticulo().getUnidad() != null ? " " + l.getArticulo().getUnidad().name() : "";
            lineas.add(l.getArticulo().getNombre() + " (" + l.getCantidad().stripTrailingZeros().toPlainString() + unidad + ")");
        }
        return lineas;
    }
}
