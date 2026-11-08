package org.example.evidencia;

import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.TipoActividad;
import org.example.domain.EstadoEvidencia;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvidencia;
import org.example.domain.OrganizacionEvidenciaRepository;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEvidencia;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EvidenciaAcreditacionRetencionJobTest {

    private static final Instant AHORA = Instant.parse("2026-11-08T12:00:00Z");

    @Mock
    private OrganizacionEvidenciaRepository repository;
    @Mock
    private ActividadService actividadService;

    private final Clock clock = Clock.fixed(AHORA, ZoneOffset.UTC);

    /** Records every call; deletes only what it was told is present. */
    static final class AlmacenFalso implements ArchivoAcreditacionAlmacen {
        final boolean disponible;
        final List<String> pedidos = new ArrayList<>();
        final Set<String> fallan;

        AlmacenFalso(boolean disponible, Set<String> fallan) {
            this.disponible = disponible;
            this.fallan = fallan;
        }

        @Override
        public boolean disponible() {
            return disponible;
        }

        @Override
        public boolean borrar(String key) {
            pedidos.add(key);
            if (fallan.contains(key)) {
                throw new IllegalStateException("store down");
            }
            return true;
        }
    }

    private EvidenciaAcreditacionRetencionJob job(ArchivoAcreditacionAlmacen almacen, boolean habilitada, int max) {
        return new EvidenciaAcreditacionRetencionJob(almacen, repository, actividadService, clock, habilitada, 12, max);
    }

    private OrganizacionEvidencia fila(long orgId, String key) {
        Organizacion org = new Organizacion();
        org.setId(orgId);
        OrganizacionEvidencia e = OrganizacionEvidencia.nueva(org, RequisitoAcreditacion.NO_DISCRIMINACION,
                TipoEvidencia.DOCUMENTO, null, LocalDate.of(2020, 1, 1), null, 1L, key);
        e.setEstado(EstadoEvidencia.REEMPLAZADA);
        return e;
    }

    @Test
    void disabledJobNeverTouchesTheRepositoryTheStoreOrTheLog() {
        AlmacenFalso almacen = new AlmacenFalso(true, Set.of());

        assertThat(job(almacen, false, 100).ejecutar()).isZero();

        assertThat(almacen.pedidos).isEmpty();
        verifyNoInteractions(repository, actividadService);
    }

    @Test
    void anUnavailableStoreMeansNoQueryAndNoDeletion() {
        AlmacenFalso almacen = new AlmacenFalso(false, Set.of());

        assertThat(job(almacen, true, 100).ejecutar()).isZero();

        verifyNoInteractions(repository, actividadService);
    }

    @Test
    void deletesTheFileMarksTheRowAndRecordsOneEventPerFile() {
        OrganizacionEvidencia a = fila(5, "org-evidencia/5/a.pdf");
        OrganizacionEvidencia b = fila(6, "org-evidencia/6/b.jpg");
        when(repository.buscarParaRetencion(eq(EstadoEvidencia.REEMPLAZADA), eq(LocalDate.of(2025, 11, 8)), any(Pageable.class)))
                .thenReturn(List.of(a, b));
        AlmacenFalso almacen = new AlmacenFalso(true, Set.of());

        int borrados = job(almacen, true, 100).ejecutar();

        assertThat(borrados).isEqualTo(2);
        assertThat(almacen.pedidos).containsExactly("org-evidencia/5/a.pdf", "org-evidencia/6/b.jpg");
        assertThat(a.getArchivoEliminadoAt()).isEqualTo(AHORA);
        assertThat(b.getArchivoEliminadoAt()).isEqualTo(AHORA);
        verify(repository).save(a);
        verify(repository).save(b);
        ArgumentCaptor<Registro> captor = ArgumentCaptor.forClass(Registro.class);
        verify(actividadService, times(2)).registrarAislado(captor.capture());
        assertThat(captor.getAllValues()).allSatisfy(r -> {
            assertThat(r.accion()).isEqualTo(TipoActividad.EVIDENCIA_ACREDITACION_ARCHIVO_BORRADO);
            assertThat(r.esSistema()).isTrue();
            assertThat(r.detalle()).doesNotContain("org-evidencia/");
        });
        assertThat(captor.getAllValues().get(0).detalle()).contains("organizacion 5");
        assertThat(captor.getAllValues().get(1).detalle()).contains("organizacion 6");
    }

    @Test
    void aFailingFileIsLeftUnmarkedForTheNextRunAndDoesNotStopTheBatch() {
        OrganizacionEvidencia mala = fila(5, "org-evidencia/5/mala.pdf");
        OrganizacionEvidencia buena = fila(5, "org-evidencia/5/buena.pdf");
        when(repository.buscarParaRetencion(any(), any(), any(Pageable.class))).thenReturn(List.of(mala, buena));
        AlmacenFalso almacen = new AlmacenFalso(true, Set.of("org-evidencia/5/mala.pdf"));

        int borrados = job(almacen, true, 100).ejecutar();

        assertThat(borrados).isEqualTo(1);
        assertThat(mala.getArchivoEliminadoAt()).isNull();
        assertThat(buena.getArchivoEliminadoAt()).isEqualTo(AHORA);
        verify(repository, never()).save(mala);
        verify(actividadService, times(1)).registrarAislado(any());
    }

    @Test
    void passesTheBatchLimitAndTheCutoffToTheQuery() {
        when(repository.buscarParaRetencion(any(), any(), any(Pageable.class))).thenReturn(List.of());

        job(new AlmacenFalso(true, Set.of()), true, 7).ejecutar();

        ArgumentCaptor<Pageable> pagina = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).buscarParaRetencion(eq(EstadoEvidencia.REEMPLAZADA), eq(LocalDate.of(2025, 11, 8)), pagina.capture());
        assertThat(pagina.getValue().getPageSize()).isEqualTo(7);
        assertThat(pagina.getValue().getPageNumber()).isZero();
    }

    @Test
    void aRepositoryFailureIsSwallowedAndNothingIsDeleted() {
        when(repository.buscarParaRetencion(any(), any(), any(Pageable.class))).thenThrow(new IllegalStateException("db down"));
        AlmacenFalso almacen = new AlmacenFalso(true, Set.of());

        assertThat(job(almacen, true, 100).ejecutar()).isZero();
        assertThat(almacen.pedidos).isEmpty();
    }
}
