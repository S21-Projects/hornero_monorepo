package org.example.domain;

/**
 * The progressive accreditation ladder for an {@link Organizacion}. Levels are cumulative: N3
 * demands every requisito below it. Replacing the previous boolean {@code validada} flip, this is
 * the stored, authoritative read model — see {@code AcreditacionReplay} for the append-only
 * history that must reconstruct it.
 */
public enum NivelAcreditacion {

    N0("REGISTRADA"),
    N1("IDENTIFICADA"),
    N2("OPERATIVA"),
    N3("ACREDITADA");

    private final String label;

    NivelAcreditacion(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
