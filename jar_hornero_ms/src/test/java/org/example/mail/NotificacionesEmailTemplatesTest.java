package org.example.mail;

import org.example.domain.NivelAcreditacion;
import org.example.domain.RequisitoAcreditacion;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class NotificacionesEmailTemplatesTest {

    private static final String ENLACE = "https://panel.elhornero.org/mis-donaciones/7";

    private static void assertBoth(MensajeCorreo m, String... fragmentos) {
        for (String f : fragmentos) {
            assertThat(m.text()).contains(f);
            assertThat(m.html()).contains(f);
        }
    }

    @Test
    void donacionAceptada_carriesOrganizationItemsAndPanelLink() {
        MensajeCorreo m = NotificacionesEmailTemplates.donacionAceptada("d@x.org", "Ana", "Comedor Sol",
                List.of("Arroz (5 KG)"), ENLACE);

        assertThat(m.to()).isEqualTo("d@x.org");
        assertThat(m.subject()).contains("Comedor Sol").containsIgnoringCase("aceptó");
        assertBoth(m, "Ana", "Comedor Sol", "Arroz (5 KG)", ENLACE);
    }

    @Test
    void donacionRechazada_saysRejectedAndLinksToThePanel() {
        MensajeCorreo m = NotificacionesEmailTemplates.donacionRechazada("d@x.org", "Ana", "Comedor Sol", ENLACE);

        assertThat(m.subject()).containsIgnoringCase("no fue aceptada");
        assertBoth(m, "Comedor Sol", ENLACE);
    }

    @Test
    void donacionVencida_explainsTheAutomaticCancellation() {
        MensajeCorreo m = NotificacionesEmailTemplates.donacionVencida("d@x.org", "Ana", "Comedor Sol", 7, ENLACE);

        assertThat(m.subject()).containsIgnoringCase("cancel");
        assertBoth(m, "Comedor Sol", "7 días", ENLACE);
    }

    @Test
    void entregaConfirmada_thanksTheDonor() {
        MensajeCorreo m = NotificacionesEmailTemplates.entregaConfirmada("d@x.org", "Ana", "Comedor Sol", ENLACE);

        assertThat(m.subject()).containsIgnoringCase("entrega");
        assertBoth(m, "Comedor Sol", "Gracias", ENLACE);
    }

    @Test
    void ofertaRecibida_tellsTheReferenteWhoOfferedWhat() {
        MensajeCorreo m = NotificacionesEmailTemplates.ofertaRecibida("r@x.org", "Rosa", "Comedor Sol",
                "Juan Pérez", List.of("Arroz (5 KG)", "Fideos (2 KG)"), ENLACE);

        assertThat(m.subject()).contains("Comedor Sol");
        assertBoth(m, "Rosa", "Juan Pérez", "Arroz (5 KG)", "Fideos (2 KG)", ENLACE);
    }

    @Test
    void propuestasRonda_summarizesCountAndCapsTheList() {
        List<String> lineas = new ArrayList<>();
        for (int i = 1; i <= 25; i++) {
            lineas.add("Comedor " + i + ": 1 donación");
        }
        MensajeCorreo m = NotificacionesEmailTemplates.propuestasRonda("r@x.org", "Rosa", 25, lineas, ENLACE);

        assertThat(m.subject()).contains("25");
        assertThat(m.text()).contains("Comedor 1: 1 donación").contains("Comedor 20: 1 donación")
                .doesNotContain("Comedor 21: 1 donación").contains("5 más");
        assertThat(m.html()).contains(ENLACE);
    }

    @Test
    void propuestasRonda_singularSubject() {
        MensajeCorreo m = NotificacionesEmailTemplates.propuestasRonda("r@x.org", "Rosa", 1,
                List.of("Comedor Sol: 1 donación"), ENLACE);

        assertThat(m.subject()).contains("1 donación").doesNotContain("donaciones");
    }

    @Test
    void organizacionAprobadaYRechazada() {
        MensajeCorreo ok = NotificacionesEmailTemplates.organizacionAprobada("r@x.org", "Rosa", "Comedor Sol", ENLACE);
        MensajeCorreo no = NotificacionesEmailTemplates.organizacionRechazada("r@x.org", "Rosa", "Comedor Sol", ENLACE);

        assertThat(ok.subject()).containsIgnoringCase("aprobada");
        assertThat(no.subject()).containsIgnoringCase("rechaz");
        assertBoth(ok, "Comedor Sol", ENLACE);
        assertBoth(no, "Comedor Sol", ENLACE);
    }

    @Test
    void nivelCambiado_showsBothLevelsAndTheMotivoWhenPresent() {
        MensajeCorreo sube = NotificacionesEmailTemplates.nivelCambiado("r@x.org", "Rosa", "Comedor Sol",
                NivelAcreditacion.N1, NivelAcreditacion.N2, null, ENLACE);
        MensajeCorreo baja = NotificacionesEmailTemplates.nivelCambiado("r@x.org", "Rosa", "Comedor Sol",
                NivelAcreditacion.N2, NivelAcreditacion.N1, "Documentación vencida", ENLACE);

        assertThat(sube.subject()).containsIgnoringCase("nivel");
        assertBoth(sube, "IDENTIFICADA", "OPERATIVA");
        assertThat(sube.text()).doesNotContain("Motivo");
        assertBoth(baja, "OPERATIVA", "IDENTIFICADA", "Documentación vencida");
    }

    @Test
    void evidenciaObservada_carriesTheObservation() {
        MensajeCorreo m = NotificacionesEmailTemplates.evidenciaObservada("r@x.org", "Rosa", "Comedor Sol",
                RequisitoAcreditacion.NO_DISCRIMINACION, "La foto no se ve", ENLACE);

        assertThat(m.subject()).containsIgnoringCase("observ");
        assertBoth(m, "Comedor Sol", "La foto no se ve", ENLACE);
    }

    @Test
    void digestAdmin_listsBothSectionsWithTotals() {
        MensajeCorreo m = NotificacionesEmailTemplates.digestAdmin("a@x.org", "Admin", 3,
                List.of("Comedor Sol", "Comedor Luna", "Merendero"), 1, List.of("Donación #5 · Comedor Sol · 16 días"),
                "https://panel.elhornero.org/admin", "https://panel.elhornero.org/control-donaciones");

        assertThat(m.subject()).containsIgnoringCase("resumen");
        assertBoth(m, "3", "Comedor Luna", "Donación #5", "https://panel.elhornero.org/control-donaciones");
    }

    @Test
    void digestAdmin_omitsAnEmptySection() {
        MensajeCorreo m = NotificacionesEmailTemplates.digestAdmin("a@x.org", "Admin", 2,
                List.of("Comedor Sol", "Merendero"), 0, List.of(),
                "https://panel.elhornero.org/admin", "https://panel.elhornero.org/control-donaciones");

        assertThat(m.text()).contains("Comedor Sol").doesNotContain("estancadas");
        assertThat(m.html()).doesNotContain("control-donaciones");
    }

    @Test
    void userProvidedTextIsEscapedInHtmlAndStrippedFromTheSubject() {
        MensajeCorreo m = NotificacionesEmailTemplates.evidenciaObservada("r@x.org", "<b>Rosa</b>",
                "Sol\r\nBcc: evil@x.org", RequisitoAcreditacion.NO_DISCRIMINACION, "<script>alert(1)</script>", ENLACE);

        assertThat(m.html()).doesNotContain("<script>").doesNotContain("<b>Rosa</b>")
                .contains("&lt;script&gt;");
        assertThat(m.subject()).doesNotContain("\r").doesNotContain("\n");
    }

    @Test
    void noMessageCarriesTokensOrCodes() {
        MensajeCorreo m = NotificacionesEmailTemplates.entregaConfirmada("d@x.org", "Ana", "Comedor Sol", ENLACE);

        assertThat(m.text()).doesNotContainIgnoringCase("token").doesNotContainIgnoringCase("código");
        assertThat(m.html()).doesNotContainIgnoringCase("token").doesNotContainIgnoringCase("código");
    }

    @Test
    void toString_doesNotLeakTheBody() {
        MensajeCorreo m = NotificacionesEmailTemplates.entregaConfirmada("d@x.org", "Ana", "Comedor Sol", ENLACE);

        assertThat(m.toString()).doesNotContain("Gracias");
    }
}
