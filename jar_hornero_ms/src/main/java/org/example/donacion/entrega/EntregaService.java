package org.example.donacion.entrega;

import lombok.RequiredArgsConstructor;
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

        return new CodigoEntregaResponse(codigoPlano, expiraEn);
    }

    @Transactional
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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "CODIGO_INVALIDO"));

        if (vigente.getExpiraEn().isBefore(clock.instant())) {
            vigente.setUsado(true);
            codigoEntregaRepository.save(vigente);
            throw new ResponseStatusException(HttpStatus.GONE, "CODIGO_EXPIRADO");
        }

        if (!passwordEncoder.matches(codigoIngresado, vigente.getCodigoHash())) {
            vigente.setIntentos(vigente.getIntentos() + 1);
            if (vigente.getIntentos() >= maxAttempts) {
                vigente.setUsado(true);
                codigoEntregaRepository.save(vigente);
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "DEMASIADOS_INTENTOS");
            }
            codigoEntregaRepository.save(vigente);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CODIGO_INVALIDO");
        }

        vigente.setUsado(true);
        codigoEntregaRepository.save(vigente);

        ConfirmacionEntrega.registrar(d, parte, clock);
        donacionRepository.save(d);

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
