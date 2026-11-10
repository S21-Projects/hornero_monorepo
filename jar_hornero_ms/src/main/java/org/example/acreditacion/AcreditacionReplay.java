package org.example.acreditacion;

import org.example.domain.NivelAcreditacion;
import org.example.domain.OrganizacionEvento;

import java.util.List;

/**
 * Pure fold over an organizacion's event log, with no Spring dependency and no repository access
 * (AD-3). Its result is the binding invariant this change must hold: replaying the log reconstructs
 * exactly the stored {@code nivel} column.
 */
public final class AcreditacionReplay {

    private AcreditacionReplay() {
    }

    /**
     * Folds the level-changing events in the given (chronological) order, starting from
     * {@link NivelAcreditacion#N0}. Events whose {@code nivelDespues} is {@code null} (e.g.
     * {@code EVIDENCIA_ADJUNTADA}, {@code REQUISITO_APROBADO}) are not level-changing and are
     * skipped.
     */
    public static NivelAcreditacion reconstruir(List<OrganizacionEvento> eventos) {
        NivelAcreditacion nivel = NivelAcreditacion.N0;
        for (OrganizacionEvento evento : eventos) {
            if (evento.getNivelDespues() != null) {
                nivel = evento.getNivelDespues();
            }
        }
        return nivel;
    }
}
