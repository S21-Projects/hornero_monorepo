package org.example.domain;

/**
 * Food category vocabulary a {@code necesidad} may declare
 * (`specs/organizacion-acreditacion/spec.md` "Level-Driven Food Category Caps"). {@code
 * nivelMinimo} is the lowest accreditation level allowed to request the category — mirrors {@link
 * RequisitoAcreditacion}'s {@code nivelExigido} convention, so {@code
 * AcreditacionService#categoriasPermitidas} can derive the permitted set without a second,
 * separately-maintained mapping.
 */
public enum CategoriaAlimento {

    NO_PERECEDERO(NivelAcreditacion.N1),
    REFRIGERADO(NivelAcreditacion.N2),
    CONGELADO(NivelAcreditacion.N2);

    private final NivelAcreditacion nivelMinimo;

    CategoriaAlimento(NivelAcreditacion nivelMinimo) {
        this.nivelMinimo = nivelMinimo;
    }

    public NivelAcreditacion getNivelMinimo() {
        return nivelMinimo;
    }
}
