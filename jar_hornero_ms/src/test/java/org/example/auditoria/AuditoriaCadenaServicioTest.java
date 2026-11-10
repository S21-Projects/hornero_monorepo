package org.example.auditoria;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.example.actividad.ActividadService;
import org.example.actividad.ResultadoActividad;
import org.example.actividad.TipoActividad;
import org.example.actividad.TipoActor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.slf4j.LoggerFactory;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AuditoriaCadenaServicioTest {

    private static final LocalDate HOY = LocalDate.of(2026, 11, 8);

    private final VerificadorCadena verificador = mock(VerificadorCadena.class);
    private final AnclaAuditoriaAlmacen ancla = mock(AnclaAuditoriaAlmacen.class);
    private final ActividadService actividad = mock(ActividadService.class);
    private final Clock reloj = Clock.fixed(Instant.parse("2026-11-08T06:40:00Z"), ZoneOffset.UTC);
    private final AuditoriaCadenaServicio servicio = new AuditoriaCadenaServicio(verificador, ancla, actividad, reloj);

    private ListAppender<ILoggingEvent> logs;
    private Logger logger;

    @BeforeEach
    void capturarLogs() {
        logger = (Logger) LoggerFactory.getLogger(AuditoriaCadenaServicio.class);
        logs = new ListAppender<>();
        logs.start();
        logger.addAppender(logs);
    }

    @AfterEach
    void soltarLogs() {
        logger.detachAppender(logs);
    }

    private static VerificadorCadena.Resultado ok() {
        return new VerificadorCadena.Resultado(true, 120, 7, 0, null, null, 0, 310L, "ab".repeat(32), "cd".repeat(32));
    }

    private static VerificadorCadena.Resultado rota() {
        return new VerificadorCadena.Resultado(false, 120, 7, 0, 42L, "CONTENIDO", 1, 310L, "ab".repeat(32), "cd".repeat(32));
    }

    @Test
    void anIntactChainPublishesTheDailyAnchorWithTheRootAndCounts() {
        when(verificador.verificar()).thenReturn(ok());
        when(ancla.publicar(eq(HOY), any())).thenReturn(true);

        VerificadorCadena.Resultado r = servicio.ejecutarDiaria();

        assertThat(r.integra()).isTrue();
        ArgumentCaptor<String> contenido = ArgumentCaptor.forClass(String.class);
        verify(ancla).publicar(eq(HOY), contenido.capture());
        assertThat(contenido.getValue()).contains("hornero-audit-anchor v1", "fecha: 2026-11-08", "eventos: 120",
                "cadenas: 7", "ultimo_evento_id: 310", "ultimo_evento_hash: " + "ab".repeat(32), "raiz: " + "cd".repeat(32));
        ArgumentCaptor<ActividadService.Registro> reg = ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividad).registrarAislado(reg.capture());
        assertThat(reg.getValue().accion()).isEqualTo(TipoActividad.AUDITORIA_ANCLA_PUBLICADA);
        assertThat(logs.list).noneMatch(e -> e.getLevel() == Level.ERROR);
    }

    @Test
    void anAnchorThatWasAlreadyPublishedTodayIsNotRecordedAgain() {
        when(verificador.verificar()).thenReturn(ok());
        when(ancla.publicar(eq(HOY), any())).thenReturn(false);

        servicio.ejecutarDiaria();

        verify(actividad, never()).registrarAislado(any());
    }

    @Test
    void aBrokenChainLogsAnErrorWithTheFirstBrokenIdRecordsAnEventAndPublishesNoAnchor() {
        when(verificador.verificar()).thenReturn(rota());

        VerificadorCadena.Resultado r = servicio.ejecutarDiaria();

        assertThat(r.integra()).isFalse();
        assertThat(logs.list).anyMatch(e -> e.getLevel() == Level.ERROR && e.getFormattedMessage().contains("42"));
        ArgumentCaptor<ActividadService.Registro> reg = ArgumentCaptor.forClass(ActividadService.Registro.class);
        verify(actividad).registrarAislado(reg.capture());
        assertThat(reg.getValue().accion()).isEqualTo(TipoActividad.AUDITORIA_CADENA_ROTA);
        assertThat(reg.getValue().resultado()).isEqualTo(ResultadoActividad.FALLO);
        assertThat(reg.getValue().esSistema()).isTrue();
        assertThat(reg.getValue().entidadTipo()).isEqualTo("ORGANIZACION_EVENTO");
        assertThat(reg.getValue().entidadId()).isEqualTo(42L);
        assertThat(reg.getValue().detalle()).contains("42", "CONTENIDO");
        verifyNoInteractions(ancla);
    }

    @Test
    void anAnchorFailureIsLoggedAndNeverBreaksTheRun() {
        when(verificador.verificar()).thenReturn(ok());
        when(ancla.publicar(any(), any())).thenThrow(new IllegalStateException("bucket down"));

        VerificadorCadena.Resultado r = servicio.ejecutarDiaria();

        assertThat(r.integra()).isTrue();
        assertThat(logs.list).anyMatch(e -> e.getLevel() == Level.ERROR && e.getFormattedMessage().contains("anchor"));
    }

    @Test
    void theOnDemandVerificationReportsButNeverPublishesAnAnchor() {
        when(verificador.verificar()).thenReturn(rota());

        servicio.verificarSolicitada();

        verify(actividad).registrarAislado(any());
        verifyNoInteractions(ancla);
    }

    @Test
    void theOnDemandVerificationOfAnIntactChainRecordsNothing() {
        when(verificador.verificar()).thenReturn(ok());

        servicio.verificarSolicitada();

        verifyNoInteractions(ancla);
        verify(actividad, never()).registrarAislado(any());
        assertThat(TipoActor.SISTEMA).isNotNull();
    }
}
