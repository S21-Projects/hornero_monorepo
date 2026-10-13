package org.example.evidencia;

import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.ResultadoActividad;
import org.example.actividad.TipoActividad;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.Executor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class EvidenciaBorradoListenerTest {

    private static final Instant T = Instant.parse("2026-01-01T00:00:00Z");
    private static final Executor SINCRONO = Runnable::run;

    @Mock
    private ActividadService actividadService;

    private final EvidenciaAlmacenEnMemoria almacen = new EvidenciaAlmacenEnMemoria();

    private Registro registrado() {
        ArgumentCaptor<Registro> captor = ArgumentCaptor.forClass(Registro.class);
        verify(actividadService).registrarAislado(captor.capture());
        return captor.getValue();
    }

    @Test
    void deletesCapturedAndStrayObjectsOfTheUser_leavingOthersUntouched_andRecordsOnlyACount() {
        almacen.con("reclamo-evidencia/1/7/a.jpg", T).con("reclamo-evidencia/1/7/b.jpg", T)
                .con("reclamo-evidencia/2/7/stray.jpg", T)
                .con("reclamo-evidencia/1/8/otro-usuario.jpg", T)
                .con("org-evidencia/1/doc.pdf", T);
        var listener = new EvidenciaBorradoListener(almacen, actividadService, SINCRONO);

        listener.alLiberarse(new EvidenciaReclamoLiberadaEvento(7L,
                List.of("reclamo-evidencia/1/7/a.jpg", "reclamo-evidencia/1/7/b.jpg")));

        assertThat(almacen.claves()).containsExactlyInAnyOrder(
                "reclamo-evidencia/1/8/otro-usuario.jpg", "org-evidencia/1/doc.pdf");
        Registro r = registrado();
        assertThat(r.accion()).isEqualTo(TipoActividad.EVIDENCIA_RECLAMO_BORRADA);
        assertThat(r.resultado()).isEqualTo(ResultadoActividad.EXITO);
        assertThat(r.esSistema()).isTrue();
        assertThat(r.entidadTipo()).isEqualTo("USUARIO");
        assertThat(r.entidadId()).isEqualTo(7L);
        assertThat(r.detalle()).isEqualTo("3 archivos de evidencia de reclamos borrados")
                .doesNotContain("reclamo-evidencia").doesNotContain("/");
    }

    @Test
    void storageFailure_isSwallowedAndRecordedAsFallo() {
        almacen.con("reclamo-evidencia/1/7/a.jpg", T);
        almacen.fallarAlBorrar = true;
        var listener = new EvidenciaBorradoListener(almacen, actividadService, SINCRONO);

        assertThatCode(() -> listener.alLiberarse(new EvidenciaReclamoLiberadaEvento(7L,
                List.of("reclamo-evidencia/1/7/a.jpg")))).doesNotThrowAnyException();

        Registro r = registrado();
        assertThat(r.accion()).isEqualTo(TipoActividad.EVIDENCIA_RECLAMO_BORRADA);
        assertThat(r.resultado()).isEqualTo(ResultadoActividad.FALLO);
        assertThat(r.detalle()).contains("IllegalStateException").doesNotContain("reclamo-evidencia");
    }
}
