package org.example.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PasswordRestablecerRequest {

    @NotBlank
    @Size(max = 200)
    private String token;

    /** Content and length are judged by {@code PasswordPolicy}; this cap only bounds the payload. */
    @NotBlank
    @Size(max = 1000)
    private String password;
}
