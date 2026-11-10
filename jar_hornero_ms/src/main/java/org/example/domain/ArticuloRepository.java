package org.example.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ArticuloRepository extends JpaRepository<Articulo, Long> {

    List<Articulo> findByActivoTrue();

    Optional<Articulo> findByNombreIgnoreCase(String nombre);

    /**
     * Admin catalog listing, paged. Filters combine with AND: {@code soloActivos} hides deactivated
     * items, {@code filtrarCategoria} enables the {@code categoria} match (the enum is ignored when
     * false, so callers pass any value), and {@code patron} is a lowercased LIKE pattern on the name
     * ({@code '%'} for "no text filter").
     */
    @Query("""
            select a from Articulo a
            where (:soloActivos = false or a.activo = true)
              and (:filtrarCategoria = false or a.categoria = :categoria)
              and lower(a.nombre) like :patron escape '\\'
            """)
    Page<Articulo> buscarAdmin(
            @Param("soloActivos") boolean soloActivos,
            @Param("filtrarCategoria") boolean filtrarCategoria,
            @Param("categoria") CategoriaAlimento categoria,
            @Param("patron") String patron,
            Pageable pageable);
}
