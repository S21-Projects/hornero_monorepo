package org.example.donacion.entrega.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class VerificarCodigoRequest {

    @NotBlank
    @Pattern(regexp = "^\\d{6}$", message = "codigo must be exactly 6 digits")
    private String codigo;
}
