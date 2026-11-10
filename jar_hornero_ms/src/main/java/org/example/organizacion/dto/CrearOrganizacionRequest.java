package org.example.organizacion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.common.validation.UrlSegura;
import org.example.domain.TipoOrganizacion;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CrearOrganizacionRequest {

    @NotBlank(message = "El nombre es obligatorio")
    private String nombre;

    @NotNull(message = "El tipo es obligatorio")
    private TipoOrganizacion tipo;

    private String descripcion;

    private String direccion;

    @NotNull(message = "La latitud es obligatoria")
    private Double latitud;

    @NotNull(message = "La longitud es obligatoria")
    private Double longitud;

    private Boolean aceptaDonaciones;

    @UrlSegura
    @Size(max = 500)
    private String sitioWebUrl;

    @UrlSegura
    @Size(max = 500)
    private String donacionDirectaUrl;
}
