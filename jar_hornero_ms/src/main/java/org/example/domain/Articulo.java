package org.example.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A catalog item (feature catalogo-articulos, decision 3): donaciones and necesidades reference
 * articulos instead of carrying a free-text description, so {@code categoria} becomes a derived
 * fact instead of a hand-picked one. Deactivation (decision 3) is the only supported removal path
 * — {@code activo} is flipped to {@code false}, the row is never hard-deleted, so historical
 * donaciones/necesidades referencing it keep resolving.
 */
@Entity
@Table(name = "articulos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Articulo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nombre;

    @Enumerated(EnumType.STRING)
    private CategoriaAlimento categoria;

    @Enumerated(EnumType.STRING)
    private UnidadArticulo unidad;

    private boolean activo = true;
}
