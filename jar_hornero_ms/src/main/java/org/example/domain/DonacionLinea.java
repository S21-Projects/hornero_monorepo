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

import java.math.BigDecimal;

/**
 * One line of a {@link Donacion} (feature catalogo-articulos, decision 4): an {@link Articulo} and
 * a {@code cantidad} (unit comes from the articulo). Full child entity, not an
 * {@code @ElementCollection}, per the feature document's recommendation — consistent with this
 * codebase's existing entity-association convention and easier to extend later (e.g. per-line
 * notes).
 */
@Entity
@Table(name = "donacion_lineas")
@Getter
@Setter
@NoArgsConstructor
public class DonacionLinea {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "articulo_id", nullable = false)
    private Articulo articulo;

    private BigDecimal cantidad;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "donacion_id", nullable = false)
    private Donacion donacion;
}
