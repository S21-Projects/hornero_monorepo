package org.example.acreditacion;

import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.TipoEventoOrganizacion;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Table-driven cases for the binding invariant of AD-3: replaying an organizacion's event log
 * reconstructs its stored {@code nivel}. Pure function, no Spring context (per AD-3).
 */
class AcreditacionReplayTest {

    private final Organizacion organizacion = new Organizacion();

    @Test
    void emptyListReturnsN0() {
        NivelAcreditacion resultado = AcreditacionReplay.reconstruir(List.of());

        assertThat(resultado).isEqualTo(NivelAcreditacion.N0);
    }

    @Test
    void singleNivelElevadoEventFromN0ToN1ReturnsN1() {
        List<OrganizacionEvento> eventos = List.of(
                OrganizacionEvento.de(
                        organizacion, TipoEventoOrganizacion.NIVEL_ELEVADO, null, "sube",
                        NivelAcreditacion.N0, NivelAcreditacion.N1));

        NivelAcreditacion resultado = AcreditacionReplay.reconstruir(eventos);

        assertThat(resultado).isEqualTo(NivelAcreditacion.N1);
    }

    @Test
    void fullSequenceN0ToN1ToN2ToN3ToN2ReturnsN2() {
        List<OrganizacionEvento> eventos = List.of(
                OrganizacionEvento.de(
                        organizacion, TipoEventoOrganizacion.NIVEL_ELEVADO, null, "sube",
                        NivelAcreditacion.N0, NivelAcreditacion.N1),
                OrganizacionEvento.de(
                        organizacion, TipoEventoOrganizacion.NIVEL_ELEVADO, null, "sube",
                        NivelAcreditacion.N1, NivelAcreditacion.N2),
                OrganizacionEvento.de(
                        organizacion, TipoEventoOrganizacion.NIVEL_ELEVADO, null, "sube",
                        NivelAcreditacion.N2, NivelAcreditacion.N3),
                OrganizacionEvento.de(
                        organizacion, TipoEventoOrganizacion.NIVEL_REDUCIDO, null, "baja",
                        NivelAcreditacion.N3, NivelAcreditacion.N2));

        NivelAcreditacion resultado = AcreditacionReplay.reconstruir(eventos);

        assertThat(resultado).isEqualTo(NivelAcreditacion.N2);
    }

    @Test
    void eventsWithNullNivelDespuesAreSkippedInTheFold() {
        List<OrganizacionEvento> eventos = List.of(
                OrganizacionEvento.de(
                        organizacion, TipoEventoOrganizacion.NIVEL_ELEVADO, null, "sube",
                        NivelAcreditacion.N0, NivelAcreditacion.N1),
                OrganizacionEvento.de(
                        organizacion, TipoEventoOrganizacion.EVIDENCIA_ADJUNTADA, null, null,
                        null, null),
                OrganizacionEvento.de(
                        organizacion, TipoEventoOrganizacion.REQUISITO_APROBADO, null, null,
                        null, null));

        NivelAcreditacion resultado = AcreditacionReplay.reconstruir(eventos);

        assertThat(resultado).isEqualTo(NivelAcreditacion.N1);
    }
}
