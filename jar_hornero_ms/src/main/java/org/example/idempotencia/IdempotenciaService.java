package org.example.idempotencia;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Claim / complete / release protocol behind {@code Idempotency-Key} (N11).
 *
 * <p>{@link #iniciar} inserts the key as {@code EN_PROCESO} in its own transaction (the repository
 * call commits before the handler runs), so a concurrent duplicate sees it immediately and the
 * unique constraint arbitrates the race. Deliberately not {@code @Transactional}: a unique
 * violation inside an open PostgreSQL transaction would poison the follow-up lookup.
 *
 * <p>A key is never allowed to block forever: an {@code EN_PROCESO} row older than
 * {@code en-proceso-max-minutos} is treated as abandoned (the process crashed mid-request) and can
 * be taken over; an expired row is simply a new operation.
 */
@Slf4j
@Service
public class IdempotenciaService {

    private static final int MAX_INTENTOS = 3;

    public enum Tipo { NUEVA, REPETICION, EN_PROCESO, PAYLOAD_DISTINTO }

    /** Outcome of {@link #iniciar}; {@code id} is set for NUEVA, status/body for REPETICION. */
    public record Decision(Tipo tipo, Long id, Integer status, String body) {
        static Decision nueva(Long id) {
            return new Decision(Tipo.NUEVA, id, null, null);
        }
    }

    private final IdempotenciaRepository repository;
    private final Clock clock;
    private final Duration ttl;
    private final Duration abandono;

    public IdempotenciaService(IdempotenciaRepository repository, Clock clock,
                               @Value("${app.idempotencia.ttl-horas:24}") long ttlHoras,
                               @Value("${app.idempotencia.en-proceso-max-minutos:2}") long enProcesoMaxMinutos) {
        this.repository = repository;
        this.clock = clock;
        this.ttl = Duration.ofHours(ttlHoras);
        this.abandono = Duration.ofMinutes(enProcesoMaxMinutos);
    }

    public Decision iniciar(Long usuarioId, String clave, String operacion, String huella) {
        for (int intento = 0; intento < MAX_INTENTOS; intento++) {
            Instant ahora = clock.instant();
            // Look first so a replay does not provoke (and log) a unique violation; the insert below
            // stays the authority for the race between two first requests.
            Optional<ClaveIdempotencia> existente =
                    repository.findByUsuarioIdAndClaveAndOperacion(usuarioId, clave, operacion);
            if (existente.isEmpty()) {
                try {
                    ClaveIdempotencia guardada = repository.saveAndFlush(
                            ClaveIdempotencia.enProceso(usuarioId, clave, operacion, huella, ahora, ahora.plus(ttl)));
                    return Decision.nueva(guardada.getId());
                } catch (DataIntegrityViolationException duplicada) {
                    existente = repository.findByUsuarioIdAndClaveAndOperacion(usuarioId, clave, operacion);
                    if (existente.isEmpty()) {
                        continue; // released between the insert and the lookup: try to claim again
                    }
                }
            }
            ClaveIdempotencia c = existente.get();
            boolean expirada = c.getExpiraEn().isBefore(ahora);
            boolean abandonada = c.getEstado() == EstadoIdempotencia.EN_PROCESO
                    && c.getCreadaEn().isBefore(ahora.minus(abandono));
            if (expirada || abandonada) {
                int tomadas = repository.reclamar(c.getId(), huella, ahora, ahora.plus(ttl),
                        ahora.minus(abandono), EstadoIdempotencia.EN_PROCESO);
                if (tomadas == 1) {
                    log.info("[idempotencia] took over {} key for user {}", expirada ? "expired" : "abandoned", usuarioId);
                    return Decision.nueva(c.getId());
                }
                continue; // somebody else took it first: re-evaluate
            }
            if (c.getEstado() == EstadoIdempotencia.EN_PROCESO) {
                return new Decision(Tipo.EN_PROCESO, c.getId(), null, null);
            }
            if (!c.getHuella().equals(huella)) {
                return new Decision(Tipo.PAYLOAD_DISTINTO, c.getId(), null, null);
            }
            return new Decision(Tipo.REPETICION, c.getId(), c.getRespuestaStatus(),
                    c.getRespuestaBody() == null ? "" : c.getRespuestaBody());
        }
        throw new IllegalStateException("Could not settle idempotency key after " + MAX_INTENTOS + " attempts");
    }

    public void completar(Long id, int status, String body) {
        repository.completar(id, status, body, EstadoIdempotencia.COMPLETADA, EstadoIdempotencia.EN_PROCESO);
    }

    /** Drops the key so the client can retry (5xx, auth denials, crashes). */
    public void liberar(Long id) {
        repository.liberar(id);
    }

    public int purgarExpiradas() {
        return repository.purgarExpiradas(clock.instant());
    }
}
