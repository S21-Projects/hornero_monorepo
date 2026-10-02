package org.example.config;

import org.example.domain.CategoriaAlimento;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrganizacionRepository;
import org.example.domain.TipoEventoOrganizacion;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * DEFECT 2 regression (end-to-end finding against a fresh DB, feature catalogo-articulos):
 * {@code AcreditacionBackfill}'s genesis migration only promotes rows whose {@code nivel} column
 * is {@code null}, but {@code Organizacion.nivel} defaults to {@code N0} in Java
 * ({@code private NivelAcreditacion nivel = NivelAcreditacion.N0;}), so a freshly seeded org
 * created by {@code DataInitializer} is never {@code null} and the backfill silently skips it —
 * every seeded org is stuck at N0 forever. N0 is excluded from rondas
 * ({@code RondaService.esCandidataElegible}), and the seeded necesidades include
 * REFRIGERADO/CONGELADO categories that N0 (and even N1) cannot request per
 * {@code CategoriaAlimento.nivelMinimo} — a non-coherent, non-demo-ready state.
 *
 * <p>{@code DataInitializer} must instead raise each seeded org's level through the domain's own
 * mechanism (an {@code OrganizacionEvento}, mirroring {@code AcreditacionBackfill}'s own
 * {@code MIGRACION_INICIAL} pattern) so the append-only event log stays consistent with the
 * stored {@code nivel}.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Transactional
class DataInitializerNivelSeedTest {

    @Autowired
    private OrganizacionRepository organizacionRepository;

    @Autowired
    private NecesidadRepository necesidadRepository;

    @Autowired
    private OrganizacionEventoRepository organizacionEventoRepository;

    @Test
    void everySeededOrgWithNecesidades_isAboveN0() {
        List<Organizacion> orgsConNecesidades = organizacionRepository.findAll().stream()
                .filter(o -> !necesidadRepository.findByOrganizacion_Id(o.getId()).isEmpty())
                .toList();

        assertThat(orgsConNecesidades).isNotEmpty();
        for (Organizacion org : orgsConNecesidades) {
            assertThat(org.getNivel())
                    .withFailMessage("Org '%s' has necesidades but is stuck at nivel %s (N0 is excluded "
                            + "from rondas)", org.getNombre(), org.getNivel())
                    .isNotEqualTo(NivelAcreditacion.N0);
        }
    }

    @Test
    void everyNecesidadCategoria_isAllowedByItsOrganizacionNivel() {
        List<Necesidad> necesidades = necesidadRepository.findAll();
        assertThat(necesidades).isNotEmpty();

        for (Necesidad n : necesidades) {
            CategoriaAlimento categoria = n.getCategoria();
            assertThat(categoria).withFailMessage("Seeded necesidad '%s' has no derived categoria",
                    n.getDescripcion()).isNotNull();

            Organizacion org = n.getOrganizacion();
            NivelAcreditacion nivelMinimoRequerido = categoria.getNivelMinimo();
            assertThat(org.getNivel().ordinal())
                    .withFailMessage("Necesidad '%s' (categoria %s, requires >= %s) belongs to org '%s' "
                                    + "at nivel %s, which cannot request it",
                            n.getDescripcion(), categoria, nivelMinimoRequerido, org.getNombre(), org.getNivel())
                    .isGreaterThanOrEqualTo(nivelMinimoRequerido.ordinal());
        }
    }

    @Test
    void everySeededOrgAboveN0_hasAConsistentEventLog() {
        List<Organizacion> orgsPromovidas = organizacionRepository.findAll().stream()
                .filter(o -> o.getNivel() != NivelAcreditacion.N0)
                .toList();

        assertThat(orgsPromovidas).isNotEmpty();
        for (Organizacion org : orgsPromovidas) {
            List<OrganizacionEvento> eventos = organizacionEventoRepository
                    .findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(org.getId());

            assertThat(eventos)
                    .withFailMessage("Org '%s' is at nivel %s but has no event explaining it", org.getNombre(),
                            org.getNivel())
                    .isNotEmpty();

            OrganizacionEvento genesis = eventos.get(0);
            assertThat(genesis.getTipo()).isEqualTo(TipoEventoOrganizacion.MIGRACION_INICIAL);
            assertThat(genesis.getNivelAntes()).isEqualTo(NivelAcreditacion.N0);

            OrganizacionEvento ultimo = eventos.get(eventos.size() - 1);
            assertThat(ultimo.getNivelDespues())
                    .withFailMessage("Org '%s' event log's last nivelDespues (%s) does not match its "
                                    + "stored nivel (%s)", org.getNombre(), ultimo.getNivelDespues(), org.getNivel())
                    .isEqualTo(org.getNivel());
        }
    }
}
