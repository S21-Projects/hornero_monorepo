package org.example.auditoria;

import lombok.extern.slf4j.Slf4j;
import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;

/**
 * Daily and on-demand verification of the accreditation event hash chain (C4).
 *
 * <p>It never alters data: a defect is logged at ERROR with the first broken id and recorded as an
 * activity entry ({@code AUDITORIA_CADENA_ROTA}, system actor, outcome FALLO), nothing more. The
 * daily run also publishes the anchor, but only for an intact chain and only through the store
 * wired by {@link AnclaAuditoriaConfig} (a no-op unless explicitly enabled).
 */
@Slf4j
@Service
public class AuditoriaCadenaServicio {

    private final VerificadorCadena verificador;
    private final AnclaAuditoriaAlmacen ancla;
    private final ActividadService actividad;
    private final Clock clock;

    public AuditoriaCadenaServicio(VerificadorCadena verificador, AnclaAuditoriaAlmacen ancla,
                                   ActividadService actividad, Clock clock) {
        this.verificador = verificador;
        this.ancla = ancla;
        this.actividad = actividad;
        this.clock = clock;
    }

    /** Verifies, reports a defect, publishes the anchor of today when the chain is intact. */
    public VerificadorCadena.Resultado ejecutarDiaria() {
        VerificadorCadena.Resultado r = verificarYReportar();
        if (r.integra()) {
            publicarAncla(r);
        }
        return r;
    }

    /** Admin-triggered check: verifies and reports a defect, never publishes. */
    public VerificadorCadena.Resultado verificarSolicitada() {
        return verificarYReportar();
    }

    private VerificadorCadena.Resultado verificarYReportar() {
        VerificadorCadena.Resultado r = verificador.verificar();
        if (r.integra()) {
            log.info("[auditoria] hash chain verified: {} event(s) in {} chain(s), {} pending seal", r.eventos(),
                    r.cadenas(), r.pendientes());
            return r;
        }
        log.error("[auditoria] HASH CHAIN BROKEN: first broken event id={} ({}), {} defect(s) in {} event(s). "
                + "Data was NOT modified. Compare with the last anchor and restore from backup if needed.",
                r.primerIdRoto(), r.motivo(), r.incidencias(), r.eventos());
        actividad.registrarAislado(ActividadService.Registro.de(TipoActividad.AUDITORIA_CADENA_ROTA)
                .sistema().fallo()
                .entidad("ORGANIZACION_EVENTO", r.primerIdRoto())
                .detalle("primer evento roto id=" + r.primerIdRoto() + " (" + r.motivo() + "), "
                        + r.incidencias() + " defecto(s) en " + r.eventos() + " eventos"));
        return r;
    }

    private void publicarAncla(VerificadorCadena.Resultado r) {
        LocalDate hoy = LocalDate.now(clock.withZone(ZoneOffset.UTC));
        try {
            if (ancla.publicar(hoy, contenidoAncla(hoy, r))) {
                log.info("[auditoria] anchor published for {}", hoy);
                actividad.registrarAislado(ActividadService.Registro.de(TipoActividad.AUDITORIA_ANCLA_PUBLICADA)
                        .sistema().detalle("ancla " + hoy + ", " + r.eventos() + " eventos"));
            }
        } catch (RuntimeException e) {
            log.error("[auditoria] could not publish the anchor for {}: {}", hoy, e.toString());
        }
    }

    static String contenidoAncla(LocalDate fecha, VerificadorCadena.Resultado r) {
        return "hornero-audit-anchor v1\n"
                + "fecha: " + fecha + "\n"
                + "eventos: " + r.eventos() + "\n"
                + "cadenas: " + r.cadenas() + "\n"
                + "ultimo_evento_id: " + r.ultimoId() + "\n"
                + "ultimo_evento_hash: " + r.ultimoHash() + "\n"
                + "raiz: " + r.raiz() + "\n";
    }
}
