package org.example.notificacion;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.scheduling.annotation.Scheduled;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class NotificacionDigestJobTest {

    @Mock private NotificacionService servicio;

    @Test
    void programado_sendsTheDigest() {
        new NotificacionDigestJob(servicio).programado();

        verify(servicio).enviarDigest();
    }

    @Test
    void programado_neverThrowsSoTheSchedulerKeepsRunning() {
        doThrow(new IllegalStateException("boom")).when(servicio).enviarDigest();

        assertThatCode(() -> new NotificacionDigestJob(servicio).programado()).doesNotThrowAnyException();
    }

    @Test
    void cron_isConfigurableAndDefaultsTo8amBuenosAires() throws Exception {
        Scheduled scheduled = NotificacionDigestJob.class.getMethod("programado").getAnnotation(Scheduled.class);

        assertThat(scheduled.cron()).isEqualTo("${app.notificaciones.digest-cron:0 0 8 * * *}");
        assertThat(scheduled.zone()).isEqualTo("America/Argentina/Buenos_Aires");
    }
}
