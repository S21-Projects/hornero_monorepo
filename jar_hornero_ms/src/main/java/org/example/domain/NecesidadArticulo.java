package org.example.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One selected {@link Articulo} of a {@link Necesidad} (feature catalogo-articulos, decision 6): no
 * quantity, unlike {@link DonacionLinea} — the org only declares which kinds of goods it needs.
 * Full child entity, mirroring {@code DonacionLinea}'s pattern (consistent with this codebase's
 * existing entity-association convention, not an {@code @ElementCollection}).
 */
@Entity
@Table(name = "necesidad_articulos")
@Getter
@Setter
@NoArgsConstructor
public class NecesidadArticulo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "articulo_id", nullable = false)
    private Articulo articulo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "necesidad_id", nullable = false)
    private Necesidad necesidad;
}
