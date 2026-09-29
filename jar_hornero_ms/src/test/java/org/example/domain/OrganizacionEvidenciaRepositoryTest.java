package org.example.domain;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.lang.reflect.Method;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code organizacion_evidencia} rows are also never hard-deleted — only {@code estado} mutates
 * (`specs/organizacion-evidencia/spec.md`, "Replacement Never Overwrites History"). Mirrors the
 * {@link OrganizacionEventoRepositoryTest} reflection pattern for the same append-only discipline.
 */
@DataJpaTest
class OrganizacionEvidenciaRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private OrganizacionEvidenciaRepository evidenciaRepository;

    @Test
    void findByOrganizacionIdReturnsOnlyThatOrganizacionsRows() {
        Organizacion orgA = persistOrganizacion("org-a");
        Organizacion orgB = persistOrganizacion("org-b");

        OrganizacionEvidencia evidenciaA = evidenciaRepository.save(nuevaEvidencia(orgA,
                RequisitoAcreditacion.NO_DISCRIMINACION));
        evidenciaRepository.save(nuevaEvidencia(orgB, RequisitoAcreditacion.NO_DISCRIMINACION));

        List<OrganizacionEvidencia> rows = evidenciaRepository.findByOrganizacion_Id(orgA.getId());

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getId()).isEqualTo(evidenciaA.getId());
    }

    @Test
    void findByOrganizacionIdAndRequisitoAndEstadoNotExcludesMatchingEstado() {
        Organizacion org = persistOrganizacion("org-c");

        OrganizacionEvidencia reemplazada = nuevaEvidencia(org, RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO);
        reemplazada.setEstado(EstadoEvidencia.REEMPLAZADA);
        evidenciaRepository.save(reemplazada);

        OrganizacionEvidencia vigente = evidenciaRepository.save(
                nuevaEvidencia(org, RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO));

        List<OrganizacionEvidencia> rows = evidenciaRepository.findByOrganizacion_IdAndRequisitoAndEstadoNot(
                org.getId(), RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO, EstadoEvidencia.REEMPLAZADA);

        assertThat(rows).extracting(OrganizacionEvidencia::getId).containsExactly(vigente.getId());
    }

    // --- Slice 2 (tesis-core-features), task 2.1: existsByOrganizacion_IdAndObjectKey backs the
    // MS's evidence-file authorization endpoint (AD-12) — file access is bound to an existing row.

    @Test
    void existsByOrganizacionIdAndObjectKeyIsTrueForTheOwningOrganizacionsRow() {
        Organizacion org = persistOrganizacion("org-d");
        OrganizacionEvidencia evidencia = OrganizacionEvidencia.nueva(org, RequisitoAcreditacion.NO_DISCRIMINACION,
                TipoEvidencia.FOTO, null, LocalDate.now(), null, 1L, "org-evidencia/" + org.getId() + "/foto.jpg");
        evidenciaRepository.save(evidencia);

        boolean existe = evidenciaRepository.existsByOrganizacion_IdAndObjectKey(
                org.getId(), "org-evidencia/" + org.getId() + "/foto.jpg");

        assertThat(existe).isTrue();
    }

    @Test
    void existsByOrganizacionIdAndObjectKeyIsFalseForTheSameKeyUnderAnotherOrganizacion() {
        Organizacion orgOwner = persistOrganizacion("org-e");
        Organizacion orgOther = persistOrganizacion("org-f");
        String key = "org-evidencia/" + orgOwner.getId() + "/foto.jpg";
        evidenciaRepository.save(OrganizacionEvidencia.nueva(orgOwner, RequisitoAcreditacion.NO_DISCRIMINACION,
                TipoEvidencia.FOTO, null, LocalDate.now(), null, 1L, key));

        boolean existe = evidenciaRepository.existsByOrganizacion_IdAndObjectKey(orgOther.getId(), key);

        assertThat(existe).isFalse();
    }

    @Test
    void existsByOrganizacionIdAndObjectKeyIsFalseForAnUnknownKey() {
        Organizacion org = persistOrganizacion("org-g");

        boolean existe = evidenciaRepository.existsByOrganizacion_IdAndObjectKey(
                org.getId(), "org-evidencia/" + org.getId() + "/no-existe.jpg");

        assertThat(existe).isFalse();
    }

    @Test
    void declaresNoDeleteMethod() {
        Method[] declaredMethods = OrganizacionEvidenciaRepository.class.getDeclaredMethods();

        boolean hasForbiddenMethod = Arrays.stream(declaredMethods)
                .anyMatch(method -> {
                    String name = method.getName();
                    return name.startsWith("delete") || name.equals("saveAndFlush");
                });

        assertThat(hasForbiddenMethod).isFalse();
    }

    private Organizacion persistOrganizacion(String slugPrefix) {
        Organizacion organizacion = new Organizacion();
        organizacion.setNombre("Comedor " + slugPrefix);
        organizacion.setSlug(slugPrefix + "-" + System.nanoTime());
        organizacion.setEstado(EstadoOrganizacion.PENDIENTE);
        organizacion.setNivel(NivelAcreditacion.N0);
        return entityManager.persistFlushFind(organizacion);
    }

    private OrganizacionEvidencia nuevaEvidencia(Organizacion org, RequisitoAcreditacion requisito) {
        return OrganizacionEvidencia.nueva(org, requisito, TipoEvidencia.DECLARACION,
                "declaración de prueba", LocalDate.now(), null, 1L);
    }
}
