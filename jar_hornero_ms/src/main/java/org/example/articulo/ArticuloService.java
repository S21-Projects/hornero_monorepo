package org.example.articulo;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.example.articulo.dto.ActualizarArticuloRequest;
import org.example.articulo.dto.CrearArticuloRequest;
import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Feature catalogo-articulos, work unit A (C2): catalog CRUD. Deactivation is the only removal
 * path (decision 3) — never a hard delete, so existing donaciones/necesidades lines keep
 * resolving the row.
 */
@Service
@RequiredArgsConstructor
public class ArticuloService {

    private final ArticuloRepository articuloRepository;

    public List<ArticuloResponse> listar(boolean incluirInactivos) {
        List<Articulo> articulos = incluirInactivos
                ? articuloRepository.findAll()
                : articuloRepository.findByActivoTrue();
        return articulos.stream().map(this::toResponse).toList();
    }

    @Transactional
    public ArticuloResponse crear(CrearArticuloRequest dto) {
        Articulo a = new Articulo();
        a.setNombre(dto.getNombre());
        a.setCategoria(dto.getCategoria());
        a.setUnidad(dto.getUnidad());
        a.setActivo(true);
        return toResponse(articuloRepository.save(a));
    }

    @Transactional
    public ArticuloResponse actualizar(Long id, ActualizarArticuloRequest dto) {
        Articulo a = articuloRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Articulo not found"));
        a.setNombre(dto.getNombre());
        a.setCategoria(dto.getCategoria());
        a.setUnidad(dto.getUnidad());
        return toResponse(articuloRepository.save(a));
    }

    @Transactional
    public ArticuloResponse desactivar(Long id) {
        Articulo a = articuloRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Articulo not found"));
        a.setActivo(false);
        return toResponse(articuloRepository.save(a));
    }

    /**
     * Orchestrator follow-up (feature catalogo-articulos): undoes a {@link #desactivar} —
     * never a separate "undelete" path, since deactivation is soft. Makes the item selectable
     * again for new donaciones/necesidades.
     */
    @Transactional
    public ArticuloResponse reactivar(Long id) {
        Articulo a = articuloRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Articulo not found"));
        a.setActivo(true);
        return toResponse(articuloRepository.save(a));
    }

    private ArticuloResponse toResponse(Articulo a) {
        return new ArticuloResponse(
                a.getId(),
                a.getNombre(),
                a.getCategoria() != null ? a.getCategoria().name() : null,
                a.getUnidad() != null ? a.getUnidad().name() : null,
                a.isActivo()
        );
    }
}
