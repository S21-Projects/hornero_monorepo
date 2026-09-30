package org.example.domain;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.lang.reflect.Method;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

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

    // --- Slice 4a (tesis-core-features), task 4a.1: buscarCola backs the cross-org audit queue
    // (AD-8, `specs/auditoria-cola-global/spec.md`). "Vencidas" takes precedence: a row that is
    // simultaneously PENDIENTE and expired must appear there, never in "Pendientes".

    @Test
    void buscarCola_pendientesTab_returnsPendienteNotExpired() {
        Organizacion org = persistOrganizacion("org-pend");
        OrganizacionEvidencia vigente = evidenciaRepository.save(
                nuevaEvidencia(org, RequisitoAcreditacion.NO_DISCRIMINACION));

        Page<OrganizacionEvidencia> page = evidenciaRepository.buscarCola(
                false, EstadoEvidencia.PENDIENTE, LocalDate.now(),
                Set.of(RequisitoAcreditacion.values()), null, PageRequest.of(0, 20));

        assertThat(page.getContent()).extracting(OrganizacionEvidencia::getId)
                .containsExactly(vigente.getId());
    }

    @Test
    void buscarCola_pendientesTab_excludesExpiredPendiente() {
        Organizacion org = persistOrganizacion("org-pend-exp");
        evidenciaRepository.save(OrganizacionEvidencia.nueva(org, RequisitoAcreditacion.NO_DISCRIMINACION,
                TipoEvidencia.DECLARACION, "declaración", LocalDate.now().minusDays(30),
                LocalDate.now().minusDays(1), 1L));

        Page<OrganizacionEvidencia> page = evidenciaRepository.buscarCola(
                false, EstadoEvidencia.PENDIENTE, LocalDate.now(),
                Set.of(RequisitoAcreditacion.values()), null, PageRequest.of(0, 20));

        assertThat(page.getContent()).isEmpty();
    }

    @Test
    void buscarCola_vencidasTab_includesAnyExpiredRowRegardlessOfEstado() {
        Organizacion org = persistOrganizacion("org-venc");
        OrganizacionEvidencia aprobadaExpirada = OrganizacionEvidencia.nueva(org,
                RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.DECLARACION, "declaración",
                LocalDate.now().minusDays(30), LocalDate.now().minusDays(1), 1L);
        aprobadaExpirada.setEstado(EstadoEvidencia.APROBADA);
        evidenciaRepository.save(aprobadaExpirada);
        evidenciaRepository.save(nuevaEvidencia(org, RequisitoAcreditacion.SEDE_INSCRIPTA_INDIVIDUALMENTE));

        Page<OrganizacionEvidencia> page = evidenciaRepository.buscarCola(
                true, EstadoEvidencia.PENDIENTE, LocalDate.now(),
                Set.of(RequisitoAcreditacion.values()), null, PageRequest.of(0, 20));

        assertThat(page.getContent()).extracting(OrganizacionEvidencia::getId)
                .containsExactly(aprobadaExpirada.getId());
    }

    @Test
    void buscarCola_vencidasTab_excludesReemplazadaUnlessExpired() {
        Organizacion org = persistOrganizacion("org-venc-reempl");
        OrganizacionEvidencia reemplazadaVigente = nuevaEvidencia(org, RequisitoAcreditacion.NO_DISCRIMINACION);
        reemplazadaVigente.setEstado(EstadoEvidencia.REEMPLAZADA);
        evidenciaRepository.save(reemplazadaVigente);

        Page<OrganizacionEvidencia> page = evidenciaRepository.buscarCola(
                true, EstadoEvidencia.PENDIENTE, LocalDate.now(),
                Set.of(RequisitoAcreditacion.values()), null, PageRequest.of(0, 20));

        assertThat(page.getContent()).isEmpty();
    }

    @Test
    void buscarCola_filtersByRequisito() {
        Organizacion org = persistOrganizacion("org-req");
        OrganizacionEvidencia match = evidenciaRepository.save(
                nuevaEvidencia(org, RequisitoAcreditacion.RADIO_50KM_BANCO_ALIMENTOS));
        evidenciaRepository.save(nuevaEvidencia(org, RequisitoAcreditacion.NO_DISCRIMINACION));

        Page<OrganizacionEvidencia> page = evidenciaRepository.buscarCola(
                false, EstadoEvidencia.PENDIENTE, LocalDate.now(),
                Set.of(RequisitoAcreditacion.RADIO_50KM_BANCO_ALIMENTOS), null, PageRequest.of(0, 20));

        assertThat(page.getContent()).extracting(OrganizacionEvidencia::getId).containsExactly(match.getId());
    }

    @Test
    void buscarCola_filtersByTipoEvidenciaAndCombinesWithRequisito() {
        Organizacion org = persistOrganizacion("org-tipo");
        OrganizacionEvidencia foto = evidenciaRepository.save(OrganizacionEvidencia.nueva(org,
                RequisitoAcreditacion.CONDICIONES_SANITARIAS_ADECUADAS, TipoEvidencia.FOTO, null,
                LocalDate.now(), null, 1L, "org-evidencia/" + org.getId() + "/foto.jpg"));
        evidenciaRepository.save(nuevaEvidencia(org, RequisitoAcreditacion.CONDICIONES_SANITARIAS_ADECUADAS));

        Page<OrganizacionEvidencia> page = evidenciaRepository.buscarCola(
                false, EstadoEvidencia.PENDIENTE, LocalDate.now(),
                Set.of(RequisitoAcreditacion.CONDICIONES_SANITARIAS_ADECUADAS), TipoEvidencia.FOTO,
                PageRequest.of(0, 20));

        assertThat(page.getContent()).extracting(OrganizacionEvidencia::getId).containsExactly(foto.getId());
    }

    @Test
    void buscarCola_noMatchesReturnsEmptyPageWithCorrectMetadata() {
        persistOrganizacion("org-empty");

        Page<OrganizacionEvidencia> page = evidenciaRepository.buscarCola(
                false, EstadoEvidencia.PENDIENTE, LocalDate.now(),
                Set.of(RequisitoAcreditacion.ACEPTA_AUDITORIAS_SIN_AVISO), null, PageRequest.of(0, 20));

        assertThat(page.getContent()).isEmpty();
        assertThat(page.getTotalElements()).isZero();
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
