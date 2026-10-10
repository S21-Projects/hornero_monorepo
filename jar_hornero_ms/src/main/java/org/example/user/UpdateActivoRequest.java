package org.example.user;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateActivoRequest {

    @NotNull
    private Boolean activo;

    /** Optional reason, stored in the activity log. */
    @Size(max = 500)
    private String motivo;
}
