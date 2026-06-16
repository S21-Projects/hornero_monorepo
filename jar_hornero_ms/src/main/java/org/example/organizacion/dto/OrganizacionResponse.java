package org.example.organizacion.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.TipoOrganizacion;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrganizacionResponse {

    private Long id;
    private String nombre;
    private String slug;
    private TipoOrganizacion tipo;
    private String descripcion;
    private String direccion;
    private Double latitud;
    private Double longitud;
    private EstadoOrganizacion estado;
    private String referenteNombre;
    private String referenteEmail;
    private String validadoPorNombre;
    private String profileImageKey;
    private String bannerKey;

    public boolean isValidada() {
        return EstadoOrganizacion.APROBADA.equals(this.estado);
    }
}
