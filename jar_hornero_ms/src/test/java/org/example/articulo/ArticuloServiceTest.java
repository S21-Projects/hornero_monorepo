package org.example.articulo;

import org.example.actividad.ActividadService;
import org.example.articulo.dto.ActualizarArticuloRequest;
import org.example.articulo.dto.CrearArticuloRequest;
import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.UnidadArticulo;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ArticuloServiceTest {

    @Mock
    private ArticuloRepository articuloRepository;

    @Mock
    private ActividadService actividadService;

    @InjectMocks
    private ArticuloService articuloService;

    private Articulo articulo(Long id, String nombre, boolean activo) {
        Articulo a = new Articulo();
        a.setId(id);
        a.setNombre(nombre);
        a.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        a.setUnidad(UnidadArticulo.KG);
        a.setActivo(activo);
        return a;
    }

    @Test
    void crear_persistsNewActivoArticulo() {
        CrearArticuloRequest dto = new CrearArticuloRequest();
        dto.setNombre("Arroz");
        dto.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        dto.setUnidad(UnidadArticulo.KG);
        when(articuloRepository.save(any(Articulo.class))).thenAnswer(inv -> inv.getArgument(0));

        ArticuloResponse response = articuloService.crear(dto);

        assertThat(response.nombre()).isEqualTo("Arroz");
        assertThat(response.activo()).isTrue();
        ArgumentCaptor<Articulo> captor = ArgumentCaptor.forClass(Articulo.class);
        verify(articuloRepository).save(captor.capture());
        assertThat(captor.getValue().isActivo()).isTrue();
    }

    @Test
    void actualizar_existingArticulo_editsNombreCategoriaUnidad() {
        Articulo existing = articulo(1L, "Arroz", true);
        when(articuloRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(articuloRepository.save(any(Articulo.class))).thenAnswer(inv -> inv.getArgument(0));

        ActualizarArticuloRequest dto = new ActualizarArticuloRequest();
        dto.setNombre("Arroz Largo Fino");
        dto.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        dto.setUnidad(UnidadArticulo.PAQUETE);

        ArticuloResponse response = articuloService.actualizar(1L, dto);

        assertThat(response.nombre()).isEqualTo("Arroz Largo Fino");
        assertThat(response.unidad()).isEqualTo(UnidadArticulo.PAQUETE.name());
    }

    @Test
    void actualizar_unknownId_throwsNotFound() {
        when(articuloRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> articuloService.actualizar(99L, new ActualizarArticuloRequest()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404");
    }

    @Test
    void desactivar_setsActivoFalse_neverDeletesTheRow() {
        Articulo existing = articulo(1L, "Arroz", true);
        when(articuloRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(articuloRepository.save(any(Articulo.class))).thenAnswer(inv -> inv.getArgument(0));

        articuloService.desactivar(1L);

        assertThat(existing.isActivo()).isFalse();
        verify(articuloRepository).save(existing);
        verify(articuloRepository, org.mockito.Mockito.never()).delete(any(Articulo.class));
        verify(articuloRepository, org.mockito.Mockito.never()).deleteById(any());
    }

    @Test
    void reactivar_setsActivoTrue() {
        Articulo existing = articulo(1L, "Arroz", false);
        when(articuloRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(articuloRepository.save(any(Articulo.class))).thenAnswer(inv -> inv.getArgument(0));

        ArticuloResponse response = articuloService.reactivar(1L);

        assertThat(response.activo()).isTrue();
        assertThat(existing.isActivo()).isTrue();
        verify(articuloRepository).save(existing);
    }

    @Test
    void reactivar_unknownId_throwsNotFound() {
        when(articuloRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> articuloService.reactivar(99L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404");
    }

    @Test
    void listar_sinIncluirInactivos_devuelveSoloActivos() {
        when(articuloRepository.findByActivoTrue())
                .thenReturn(List.of(articulo(1L, "Arroz", true)));

        List<ArticuloResponse> result = articuloService.listar(false);

        assertThat(result).extracting(ArticuloResponse::nombre).containsExactly("Arroz");
        verify(articuloRepository).findByActivoTrue();
    }

    @Test
    void listar_incluirInactivos_devuelveTodos() {
        when(articuloRepository.findAll())
                .thenReturn(List.of(articulo(1L, "Arroz", true), articulo(2L, "Queso viejo", false)));

        List<ArticuloResponse> result = articuloService.listar(true);

        assertThat(result).extracting(ArticuloResponse::nombre)
                .containsExactlyInAnyOrder("Arroz", "Queso viejo");
    }

    @Test
    void desactivar_recordsAdminActionInSameTransaction() {
        org.example.domain.Articulo a = new org.example.domain.Articulo();
        a.setId(4L);
        a.setActivo(true);
        org.mockito.Mockito.when(articuloRepository.findById(4L)).thenReturn(java.util.Optional.of(a));
        org.mockito.Mockito.when(articuloRepository.save(org.mockito.ArgumentMatchers.any())).thenAnswer(i -> i.getArgument(0));

        articuloService.desactivar(4L);

        org.mockito.ArgumentCaptor<ActividadService.Registro> captor =
                org.mockito.ArgumentCaptor.forClass(ActividadService.Registro.class);
        org.mockito.Mockito.verify(actividadService).registrar(captor.capture());
        org.assertj.core.api.Assertions.assertThat(captor.getValue().accion())
                .isEqualTo(org.example.actividad.TipoActividad.ARTICULO_DESACTIVADO);
        org.assertj.core.api.Assertions.assertThat(captor.getValue().entidadId()).isEqualTo(4L);
    }

    @Test
    void listarAdmin_sinFiltros_buscaTodoIncluyendoSoloActivosPorDefecto() {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, 10);
        when(articuloRepository.buscarAdmin(org.mockito.ArgumentMatchers.anyBoolean(),
                org.mockito.ArgumentMatchers.anyBoolean(), any(), org.mockito.ArgumentMatchers.anyString(), any()))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(articulo(1L, "Arroz", true)), pageable, 1));

        org.springframework.data.domain.Page<ArticuloResponse> result =
                articuloService.listarAdmin(false, null, null, pageable);

        assertThat(result.getContent()).extracting(ArticuloResponse::nombre).containsExactly("Arroz");
        verify(articuloRepository).buscarAdmin(
                org.mockito.ArgumentMatchers.eq(true), org.mockito.ArgumentMatchers.eq(false),
                any(), org.mockito.ArgumentMatchers.eq("%"), org.mockito.ArgumentMatchers.eq(pageable));
    }

    @Test
    void listarAdmin_conFiltros_pasaCategoriaInactivosYPatronEscapado() {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(1, 25);
        when(articuloRepository.buscarAdmin(org.mockito.ArgumentMatchers.anyBoolean(),
                org.mockito.ArgumentMatchers.anyBoolean(), any(), org.mockito.ArgumentMatchers.anyString(), any()))
                .thenReturn(org.springframework.data.domain.Page.empty(pageable));

        articuloService.listarAdmin(true, CategoriaAlimento.REFRIGERADO, "  100%_Leche ", pageable);

        verify(articuloRepository).buscarAdmin(
                org.mockito.ArgumentMatchers.eq(false), org.mockito.ArgumentMatchers.eq(true),
                org.mockito.ArgumentMatchers.eq(CategoriaAlimento.REFRIGERADO),
                org.mockito.ArgumentMatchers.eq("%100\\%\\_leche%"), org.mockito.ArgumentMatchers.eq(pageable));
    }
}
