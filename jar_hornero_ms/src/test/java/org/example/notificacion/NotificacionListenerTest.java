package org.example.notificacion;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificacionListenerTest {

    @Mock private NotificacionService servicio;

    private final NotificacionEvento evento = new NotificacionEvento.DonacionDecidida(5L, true);

    @Test
    void enabled_handsTheEventToTheMailExecutor() {
        when(servicio.habilitado()).thenReturn(true);
        Executor sincrono = Runnable::run;

        new NotificacionListener(servicio, sincrono).alConfirmarse(evento);

        verify(servicio).procesar(evento);
    }

    @Test
    void enabled_doesNotRunOnTheCallingThreadWhenTheExecutorDefersIt() {
        when(servicio.habilitado()).thenReturn(true);
        Executor diferido = r -> { /* never runs: stands for a busy pool */ };

        new NotificacionListener(servicio, diferido).alConfirmarse(evento);

        verify(servicio, never()).procesar(evento);
    }

    @Test
    void killSwitch_queuesNothing() {
        when(servicio.habilitado()).thenReturn(false);
        Executor falla = r -> { throw new AssertionError("must not be used"); };

        new NotificacionListener(servicio, falla).alConfirmarse(evento);

        verify(servicio, never()).procesar(evento);
    }

    @Test
    void rejectedByTheExecutor_isSwallowedSoTheRequestIsNeverAffected() {
        when(servicio.habilitado()).thenReturn(true);
        Executor saturado = r -> { throw new RejectedExecutionException("full"); };

        assertThatCode(() -> new NotificacionListener(servicio, saturado).alConfirmarse(evento))
                .doesNotThrowAnyException();
        verifyNoInteractions(org.mockito.Mockito.mock(Object.class));
    }
}
