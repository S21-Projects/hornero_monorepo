package org.example.organizacion.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
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
    private String profileImageUrl;
    private String bannerUrl;
}
