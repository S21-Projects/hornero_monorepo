package org.example.user;

import jakarta.persistence.*;
import lombok.*;

@Entity
@DiscriminatorValue("ADMINISTRADOR")
@Getter
@Setter
@NoArgsConstructor
public class Administrador extends Usuario {

    public Administrador(Long id, String nombre, String email, String password, boolean activo) {
        super(id, nombre, email, password, activo);
    }
}
