package org.example.domain;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Which rows the retention job may delete files for: REEMPLAZADA, or expired before the cutoff. */
@DataJpaTest
class OrganizacionEvidenciaRetencionQueryTest {

    private static final LocalDate CORTE = LocalDate.of(2025, 11, 8);

    @Autowired
    private TestEntityManager entityManager;
    @Autowired
    private OrganizacionEvidenciaRepository repository;

    private Organizacion org;

    private OrganizacionEvidencia fila(String key, EstadoEvidencia estado, LocalDate validoHasta) {
        if (org == null) {
            Organizacion o = new Organizacion();
            o.setNombre("Comedor Retencion");
            o.setSlug("comedor-retencion-" + System.nanoTime());
            o.setEstado(EstadoOrganizacion.PENDIENTE);
            o.setNivel(NivelAcreditacion.N0);
            org = entityManager.persistFlushFind(o);
        }
        OrganizacionEvidencia e = OrganizacionEvidencia.nueva(org, RequisitoAcreditacion.NO_DISCRIMINACION,
                TipoEvidencia.DOCUMENTO, null, LocalDate.of(2020, 1, 1), validoHasta, 1L, key);
        e.setEstado(estado);
        return repository.save(e);
    }

    private List<String> claves(int max) {
        return repository.buscarParaRetencion(EstadoEvidencia.REEMPLAZADA, CORTE, PageRequest.of(0, max))
                .stream().map(OrganizacionEvidencia::getObjectKey).toList();
    }

    @Test
    void selectsReplacedRowsAndRowsExpiredBeforeTheCutoff() {
        fila("org-evidencia/1/reemplazada.pdf", EstadoEvidencia.REEMPLAZADA, null);
        fila("org-evidencia/1/vencida-hace-mucho.pdf", EstadoEvidencia.APROBADA, CORTE.minusDays(1));
        entityManager.flush();

        assertThat(claves(10)).containsExactlyInAnyOrder(
                "org-evidencia/1/reemplazada.pdf", "org-evidencia/1/vencida-hace-mucho.pdf");
    }

    @Test
    void leavesAloneRecentlyExpiredNeverExpiringAndCurrentRows() {
        fila("org-evidencia/1/en-el-corte.pdf", EstadoEvidencia.APROBADA, CORTE);
        fila("org-evidencia/1/vencida-hace-poco.pdf", EstadoEvidencia.APROBADA, CORTE.plusDays(30));
        fila("org-evidencia/1/sin-vencimiento.pdf", EstadoEvidencia.APROBADA, null);
        fila("org-evidencia/1/pendiente.pdf", EstadoEvidencia.PENDIENTE, null);
        fila("org-evidencia/1/observada.pdf", EstadoEvidencia.OBSERVADA, CORTE.plusYears(1));
        entityManager.flush();

        assertThat(claves(10)).isEmpty();
    }

    @Test
    void skipsRowsWithoutFileAndRowsWhoseFileWasAlreadyDeleted() {
        fila(null, EstadoEvidencia.REEMPLAZADA, null);
        OrganizacionEvidencia yaBorrada = fila("org-evidencia/1/ya-borrada.pdf", EstadoEvidencia.REEMPLAZADA, null);
        yaBorrada.setArchivoEliminadoAt(Instant.parse("2026-01-01T00:00:00Z"));
        repository.save(yaBorrada);
        entityManager.flush();

        assertThat(claves(10)).isEmpty();
    }

    @Test
    void honoursTheBatchLimitOldestRowFirst() {
        fila("org-evidencia/1/a.pdf", EstadoEvidencia.REEMPLAZADA, null);
        fila("org-evidencia/1/b.pdf", EstadoEvidencia.REEMPLAZADA, null);
        fila("org-evidencia/1/c.pdf", EstadoEvidencia.REEMPLAZADA, null);
        entityManager.flush();

        assertThat(claves(2)).containsExactly("org-evidencia/1/a.pdf", "org-evidencia/1/b.pdf");
    }

    @Test
    void existsDeletedFlagIsTrueOnlyAfterTheFileWasDeleted() {
        OrganizacionEvidencia e = fila("org-evidencia/1/x.pdf", EstadoEvidencia.REEMPLAZADA, null);
        assertThat(repository.existsByOrganizacion_IdAndObjectKeyAndArchivoEliminadoAtIsNotNull(
                org.getId(), "org-evidencia/1/x.pdf")).isFalse();

        e.setArchivoEliminadoAt(Instant.now());
        repository.save(e);
        entityManager.flush();

        assertThat(repository.existsByOrganizacion_IdAndObjectKeyAndArchivoEliminadoAtIsNotNull(
                org.getId(), "org-evidencia/1/x.pdf")).isTrue();
    }
}
