package org.example.organizacion.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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
    private Boolean validada;
    private String referenteNombre;
    private String referenteEmail;
    private String validadoPorNombre;
}
