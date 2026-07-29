package org.example.user;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "usuarios")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "tipo", discriminatorType = DiscriminatorType.STRING)
@Getter
@Setter
@NoArgsConstructor
public abstract class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nombre;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private boolean activo = true;

    /**
     * Grandfathering: existing rows get {@code true} via the column default
     * (see design decision #2), new rows written through this Java field get
     * {@code false} until they confirm an OTP.
     */
    @Column(nullable = false, columnDefinition = "boolean not null default true")
    private boolean emailVerificado = false;

    protected Usuario(Long id, String nombre, String email, String password, boolean activo) {
        this.id = id;
        this.nombre = nombre;
        this.email = email;
        this.password = password;
        this.activo = activo;
    }
}
