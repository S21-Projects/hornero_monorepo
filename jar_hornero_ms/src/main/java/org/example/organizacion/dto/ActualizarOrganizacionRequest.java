package org.example.organizacion.dto;

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
public class ActualizarOrganizacionRequest {

    private String nombre;
    private TipoOrganizacion tipo;
    private String descripcion;
    private String direccion;
    private Double latitud;
    private Double longitud;
    private String profileImageKey;
    private String bannerKey;

    private Boolean aceptaDonaciones;

    @UrlSegura
    @Size(max = 500)
    private String sitioWebUrl;

    @UrlSegura
    @Size(max = 500)
    private String donacionDirectaUrl;
}
