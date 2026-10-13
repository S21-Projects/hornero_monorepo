package org.example.notificacion;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.concurrent.Executor;

/**
 * N13: the bridge between "the transaction committed" and "send the email". The services publish
 * {@link NotificacionEvento}s inside their transaction; this listener fires only
 * {@code AFTER_COMMIT}, so a rolled-back operation never sends anything, and hands the work to the
 * async mail executor, so the request thread never waits for (or fails because of) the provider.
 *
 * <p>An event published outside any transaction is NOT delivered (no {@code fallbackExecution}):
 * every publisher is a transactional service method, and delivering an uncommitted fact would
 * defeat the purpose.
 */
@Slf4j
@Component
public class NotificacionListener {

    private final NotificacionService servicio;
    private final Executor mailExecutor;

    public NotificacionListener(NotificacionService servicio, @Qualifier("mailExecutor") Executor mailExecutor) {
        this.servicio = servicio;
        this.mailExecutor = mailExecutor;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alConfirmarse(NotificacionEvento evento) {
        if (!servicio.habilitado()) {
            return;
        }
        try {
            mailExecutor.execute(() -> servicio.procesar(evento));
        } catch (RuntimeException e) {
            // A saturated/shut-down pool must not turn a committed business action into an error.
            log.warn("[notificacion] no se pudo encolar {}: {}", evento.getClass().getSimpleName(),
                    e.getClass().getSimpleName());
        }
    }
}
