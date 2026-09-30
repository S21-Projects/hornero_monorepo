package org.example.acreditacion.dto;

import org.example.domain.NivelAcreditacion;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEvidencia;

/**
 * The cross-org audit queue's optional filters (AD-8): every field is independently optional and
 * they combine with AND. {@code nivel} is resolved by {@code AcreditacionService} to the set of
 * {@link RequisitoAcreditacion} whose {@code nivelExigido} matches — it does not filter by the
 * organizacion's own current level.
 */
public record ColaAuditoriaFiltro(
        TabCola tab,
        NivelAcreditacion nivel,
        RequisitoAcreditacion requisito,
        TipoEvidencia tipoEvidencia) {
}
