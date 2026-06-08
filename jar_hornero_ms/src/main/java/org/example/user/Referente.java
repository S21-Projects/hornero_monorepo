package org.example.user;

import jakarta.persistence.*;
import lombok.*;

@Entity
@DiscriminatorValue("REFERENTE")
@Getter
@Setter
@NoArgsConstructor
public class Referente extends Usuario {

    public Referente(Long id, String nombre, String email, String password, boolean activo) {
        super(id, nombre, email, password, activo);
    }
}
