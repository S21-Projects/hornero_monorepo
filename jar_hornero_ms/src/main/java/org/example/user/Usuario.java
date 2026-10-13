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

    public static final String NOMBRE_ANONIMO = "Usuario eliminado";
    /** RFC 2606 reserved TLD: mail to it can never be delivered. */
    public static final String DOMINIO_ANONIMO = "anonimo.invalid";

    /** True once {@link #anonimizar} ran: the email is an {@code @anonimo.invalid} placeholder. */
    public boolean esAnonimo() {
        return email != null && email.endsWith("@" + DOMINIO_ANONIMO);
    }

    /**
     * N15/D12: irreversibly replaces every personal field. The caller supplies a random email
     * placeholder and a hash of a random secret nobody knows, so neither can be derived from the
     * original values.
     */
    public void anonimizar(String emailAnonimo, String passwordInutilizable) {
        this.nombre = NOMBRE_ANONIMO;
        this.email = emailAnonimo;
        this.password = passwordInutilizable;
        this.activo = false;
        this.emailVerificado = false;
    }
}
