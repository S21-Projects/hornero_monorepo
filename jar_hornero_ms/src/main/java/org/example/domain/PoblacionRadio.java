package org.example.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

/**
 * 2022 census population of one radio. Read-only for the MS: the rows are loaded in bulk by
 * {@code make importar-poblacion} (V011). The entity exists so H2 test contexts
 * ({@code ddl-auto=create-drop}) get the table; on Postgres {@code ddl-auto=update} is a no-op.
 */
@Entity
@Immutable
@Table(name = "poblacion_radio")
@Getter
@Setter
@NoArgsConstructor
public class PoblacionRadio {

    @Id
    @Column(name = "codigo_radio", length = 9)
    private String codigoRadio;

    @Column(nullable = false)
    private int habitantes;
}
