package org.example.articulo;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.TipoActividad;
import org.example.articulo.dto.ActualizarArticuloRequest;
import org.example.articulo.dto.CrearArticuloRequest;
import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.example.domain.CategoriaAlimento;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
    private final ActividadService actividadService;

    public List<ArticuloResponse> listar(boolean incluirInactivos) {
        List<Articulo> articulos = incluirInactivos
                ? articuloRepository.findAll()
                : articuloRepository.findByActivoTrue();
        return articulos.stream().map(this::toResponse).toList();
    }

    /**
     * Admin catalog listing, paged and filtered server-side. {@code categoria} keeps one category,
     * {@code q} is a case-insensitive "nombre contains"; either may be null. Deactivated items are
     * included only when {@code incluirInactivos} is true.
     */
    public Page<ArticuloResponse> listarAdmin(boolean incluirInactivos, CategoriaAlimento categoria,
                                              String q, Pageable pageable) {
        return articuloRepository.buscarAdmin(
                        !incluirInactivos,
                        categoria != null,
                        categoria != null ? categoria : CategoriaAlimento.values()[0],
                        patronContiene(q),
                        pageable)
                .map(this::toResponse);
    }

    /** Lowercased LIKE pattern for "contains", with LIKE wildcards in the input escaped (escape char is '\\'). */
    private static String patronContiene(String q) {
        if (q == null || q.isBlank()) return "%";
        String escapado = q.trim().toLowerCase()
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escapado + "%";
    }

    @Transactional
    public ArticuloResponse crear(CrearArticuloRequest dto) {
        Articulo a = new Articulo();
        a.setNombre(dto.getNombre());
        a.setCategoria(dto.getCategoria());
        a.setUnidad(dto.getUnidad());
        a.setActivo(true);
        Articulo guardado = articuloRepository.save(a);
        actividadService.registrar(Registro.de(TipoActividad.ARTICULO_CREADO)
                .entidad("ARTICULO", guardado.getId()).detalle(guardado.getNombre()));
        return toResponse(guardado);
    }

    @Transactional
    public ArticuloResponse actualizar(Long id, ActualizarArticuloRequest dto) {
        Articulo a = articuloRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Articulo not found"));
        a.setNombre(dto.getNombre());
        a.setCategoria(dto.getCategoria());
        a.setUnidad(dto.getUnidad());
        Articulo guardado = articuloRepository.save(a);
        actividadService.registrar(Registro.de(TipoActividad.ARTICULO_ACTUALIZADO)
                .entidad("ARTICULO", id).detalle(guardado.getNombre()));
        return toResponse(guardado);
    }

    @Transactional
    public ArticuloResponse desactivar(Long id) {
        Articulo a = articuloRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Articulo not found"));
        a.setActivo(false);
        Articulo guardado = articuloRepository.save(a);
        actividadService.registrar(Registro.de(TipoActividad.ARTICULO_DESACTIVADO)
                .entidad("ARTICULO", id).cambio("activo", "inactivo"));
        return toResponse(guardado);
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
        Articulo guardado = articuloRepository.save(a);
        actividadService.registrar(Registro.de(TipoActividad.ARTICULO_REACTIVADO)
                .entidad("ARTICULO", id).cambio("inactivo", "activo"));
        return toResponse(guardado);
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
