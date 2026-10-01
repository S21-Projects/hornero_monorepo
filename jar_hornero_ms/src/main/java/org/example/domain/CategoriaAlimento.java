package org.example.domain;

import java.util.Collection;
import java.util.Comparator;

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

    /**
     * Feature catalogo-articulos, decision 5: a donación's (or necesidad's) categoria is the most
     * demanding of its lines'/selections' categorias, ordered by {@link #getNivelMinimo()}. A tie
     * between two categorias sharing the same {@code nivelMinimo} (e.g. {@code REFRIGERADO} and
     * {@code CONGELADO}, both {@code N2}) resolves to whichever is encountered first — both impose
     * the same accreditation-level requirement, so the choice between them is not semantically
     * significant.
     */
    public static CategoriaAlimento masExigente(Collection<CategoriaAlimento> categorias) {
        if (categorias == null || categorias.isEmpty()) {
            throw new IllegalArgumentException("categorias must not be empty");
        }
        return categorias.stream()
                .max(Comparator.comparing(c -> c.getNivelMinimo().ordinal()))
                .orElseThrow();
    }
}
