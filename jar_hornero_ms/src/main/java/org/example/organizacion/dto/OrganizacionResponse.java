package org.example.organizacion.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.domain.EstadoOrganizacion;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrganizacionResponse {

    private Long id;
    private String nombre;
    private String slug;
    private String tipo;
    private String descripcion;
    private String direccion;
    private Double latitud;
    private Double longitud;
    private EstadoOrganizacion estado;
    private String referenteNombre;
    private String referenteEmail;
    private String validadoPorNombre;

    public boolean isValidada() {
        return EstadoOrganizacion.APROBADA.equals(this.estado);
    }
}
