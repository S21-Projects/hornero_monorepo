package org.example.organizacion.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AsignarReferenteRequest {

    /**
     * Target referente's user id. {@code null} unassigns the organizacion
     * (referente_id becomes NULL).
     */
    private Long referenteId;
}
