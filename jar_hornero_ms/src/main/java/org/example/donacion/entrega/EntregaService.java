package org.example.donacion.entrega;

import lombok.RequiredArgsConstructor;
import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.TipoActividad;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.donacion.ConfirmacionEntrega;
import org.example.donacion.ParticipantesDonacion;
import org.example.donacion.entrega.dto.CodigoEntregaResponse;
import org.example.donacion.entrega.dto.EntregaEstadoResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.example.domain.EstadoDonacion;
import org.example.notificacion.NotificacionEvento;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

/**
 * Owns the mutual delivery-code lifecycle (AD-6): generate (hash + persist + throttle + burn the
 * previous unused code), verify (match + single-use + bounded attempts + row-locked mutual-state
 * transition), and status polling. Mirrors {@code OtpService}'s shape, scoped to one donación and
 * one party instead of one email.
 */
@Service
@RequiredArgsConstructor
public class EntregaService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final DonacionRepository donacionRepository;
    private final CodigoEntregaRepository codigoEntregaRepository;
    private final CodigoEntregaThrottle throttle;
    private final BCryptPasswordEncoder passwordEncoder;
    private final Clock clock;
    private final ActividadService actividadService;
    private final ApplicationEventPublisher eventPublisher;

    @Value("${app.entrega.ttl-minutes}")
    private long ttlMinutes;

    @Value("${app.entrega.max-attempts}")
    private int maxAttempts;

    @Transactional
    public CodigoEntregaResponse generar(Long donacionId, Long actorId) {
        Donacion d = donacionRepository.findByIdWithRelations(donacionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Donacion not found"));

        ParticipantesDonacion.Parte parte = ParticipantesDonacion.parteDe(d, actorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"));

        if (yaConfirmadoPorLaContraparte(d, parte)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "YA_CONFIRMADO");
        }

        throttle.checkAndRecord(donacionId, actorId);

        // Regenerating burns every previously issued, still-unused code of this emisor for this
        // donación immediately (decision 3) — even if still within its original TTL.
        List<CodigoEntrega> previos =
                codigoEntregaRepository.findByDonacion_IdAndEmisorIdAndUsadoFalse(donacionId, actorId);
        for (CodigoEntrega previo : previos) {
            previo.setUsado(true);
            codigoEntregaRepository.save(previo);
        }

        String codigoPlano = generarCodigo();
        CodigoEntrega nuevo = new CodigoEntrega();
        nuevo.setDonacion(d);
        nuevo.setEmisorId(actorId);
        nuevo.setEmisorParte(parte);
        nuevo.setCodigoHash(passwordEncoder.encode(codigoPlano));
        var expiraEn = clock.instant().plus(ttlMinutes, ChronoUnit.MINUTES);
        nuevo.setExpiraEn(expiraEn);
        nuevo.setIntentos(0);
        nuevo.setUsado(false);
        nuevo.setCreadoEn(clock.instant());
        codigoEntregaRepository.save(nuevo);

        // Never the code itself (ASVS 16.2.5): only who generated one for which donación.
        actividadService.registrar(Registro.de(TipoActividad.ENTREGA_CODIGO_GENERADO)
                .entidad("DONACION", donacionId).detalle("parte " + parte));

        return new CodigoEntregaResponse(codigoPlano, expiraEn);
    }

    /**
     * {@code noRollbackFor}: the attempt counter, the lockout and the expiry burn are persisted and
     * THEN reported as a {@link ResponseStatusException}; rolling back would lose that bookkeeping.
     */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public EntregaEstadoResponse verificar(Long donacionId, Long actorId, String codigoIngresado) {
        Donacion d = donacionRepository.findByIdForUpdate(donacionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Donacion not found"));

        ParticipantesDonacion.Parte parte = ParticipantesDonacion.parteDe(d, actorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"));

        // Re-verifying one's own already-satisfied side is idempotent: mirrors confirmarEntrega's
        // historical behaviour and never consumes an attempt against a counterpart code.
        if (yaConfirmoEstaParte(d, parte)) {
            return toEstadoResponse(d);
        }

        ParticipantesDonacion.Parte contraparte = contraparteDe(parte);
        CodigoEntrega vigente = codigoEntregaRepository
                .findTopByDonacion_IdAndEmisorParteAndUsadoFalseOrderByCreadoEnDesc(donacionId, contraparte)
                .orElseThrow(() -> {
                    fallo(TipoActividad.ENTREGA_CODIGO_VERIFICACION, donacionId, actorId, parte, "SIN_CODIGO_VIGENTE");
                    return new ResponseStatusException(HttpStatus.BAD_REQUEST, "CODIGO_INVALIDO");
                });

        if (vigente.getExpiraEn().isBefore(clock.instant())) {
            vigente.setUsado(true);
            codigoEntregaRepository.save(vigente);
            fallo(TipoActividad.ENTREGA_CODIGO_VERIFICACION, donacionId, actorId, parte, "CODIGO_EXPIRADO");
            throw new ResponseStatusException(HttpStatus.GONE, "CODIGO_EXPIRADO");
        }

        if (!passwordEncoder.matches(codigoIngresado, vigente.getCodigoHash())) {
            vigente.setIntentos(vigente.getIntentos() + 1);
            if (vigente.getIntentos() >= maxAttempts) {
                vigente.setUsado(true);
                codigoEntregaRepository.save(vigente);
                fallo(TipoActividad.ENTREGA_CODIGO_BLOQUEO, donacionId, actorId, parte, "DEMASIADOS_INTENTOS");
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "DEMASIADOS_INTENTOS");
            }
            codigoEntregaRepository.save(vigente);
            fallo(TipoActividad.ENTREGA_CODIGO_VERIFICACION, donacionId, actorId, parte,
                    "CODIGO_INVALIDO (intento " + vigente.getIntentos() + ")");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CODIGO_INVALIDO");
        }

        vigente.setUsado(true);
        codigoEntregaRepository.save(vigente);

        EstadoDonacion estadoAntes = d.getEstado();
        ConfirmacionEntrega.registrar(d, parte, clock);
        donacionRepository.save(d);
        // Success commits with the confirmation itself (same transaction).
        actividadService.registrar(Registro.de(TipoActividad.ENTREGA_CODIGO_VERIFICACION)
                .entidad("DONACION", donacionId).detalle("parte " + parte));
        if (d.getEstado() == EstadoDonacion.ENTREGADA && estadoAntes != EstadoDonacion.ENTREGADA) {
            eventPublisher.publishEvent(new NotificacionEvento.EntregaConfirmada(donacionId));
        }

        return toEstadoResponse(d);
    }

    @Transactional(readOnly = true)
    public EntregaEstadoResponse estado(Long donacionId, Long actorId) {
        Donacion d = donacionRepository.findByIdWithRelations(donacionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Donacion not found"));

        ParticipantesDonacion.parteDe(d, actorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"));

        return toEstadoResponse(d);
    }

    /**
     * Failure/lockout rows go through the isolated write: this transaction's row lock and its
     * counters are unrelated to the audit row, and the row must exist whatever happens next to the
     * caller's transaction (ASVS 16.3.3). Never receives the submitted code.
     */
    private void fallo(TipoActividad accion, Long donacionId, Long actorId, ParticipantesDonacion.Parte parte,
                       String motivo) {
        actividadService.registrarAislado(Registro.de(accion).fallo().actor(actorId, parte.name())
                .entidad("DONACION", donacionId).detalle("parte " + parte + ": " + motivo));
    }

    private boolean yaConfirmoEstaParte(Donacion d, ParticipantesDonacion.Parte parte) {
        return parte == ParticipantesDonacion.Parte.DONANTE
                ? d.getConfirmadaDonanteEn() != null
                : d.getConfirmadaReferenteEn() != null;
    }

    /**
     * "the counterpart already validated this party's code" (AD-6): the counterpart is the
     * *verifier* whose own confirmation timestamp is set when they validate the emisor's code, so
     * this reads the counterpart's timestamp, not the emisor's own.
     */
    private boolean yaConfirmadoPorLaContraparte(Donacion d, ParticipantesDonacion.Parte emisorParte) {
        return yaConfirmoEstaParte(d, contraparteDe(emisorParte));
    }

    private ParticipantesDonacion.Parte contraparteDe(ParticipantesDonacion.Parte parte) {
        return parte == ParticipantesDonacion.Parte.DONANTE
                ? ParticipantesDonacion.Parte.REFERENTE
                : ParticipantesDonacion.Parte.DONANTE;
    }

    private EntregaEstadoResponse toEstadoResponse(Donacion d) {
        return new EntregaEstadoResponse(d.getEstado().name(), d.getConfirmadaDonanteEn(), d.getConfirmadaReferenteEn());
    }

    private String generarCodigo() {
        int value = RANDOM.nextInt(1_000_000);
        return String.format("%06d", value);
    }
}
