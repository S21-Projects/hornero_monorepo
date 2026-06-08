package org.example.user;

import jakarta.persistence.*;
import lombok.*;

@Entity
@DiscriminatorValue("DONANTE")
@Getter
@Setter
@NoArgsConstructor
public class Donante extends Usuario {

    public Donante(Long id, String nombre, String email, String password, boolean activo) {
        super(id, nombre, email, password, activo);
    }
}
