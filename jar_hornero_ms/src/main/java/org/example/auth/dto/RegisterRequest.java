package org.example.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequest {

    @NotBlank(message = "El nombre es obligatorio")
    private String nombre;

    @NotBlank(message = "El email es obligatorio")
    @Email(message = "Formato de email inválido")
    private String email;

    @NotBlank(message = "La contraseña es obligatoria")
    // Bounds and strength are enforced by PasswordPolicy (needs email/nombre context); this cap
    // only stops oversized payloads before they reach it. UTF-16 units: 64 code points <= 128.
    @Size(max = 128, message = "PASSWORD_DEMASIADO_LARGA")
    private String password;

    /**
     * Optional. Accepted values: REFERENTE, DONANTE.
     * Defaults to REFERENTE if absent or invalid.
     * ADMINISTRADOR is never allowed via public registration.
     */
    private String tipo;
}
