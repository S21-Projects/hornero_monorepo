package org.example.domain;

import jakarta.persistence.*;
import lombok.*;
import org.example.user.Administrador;
import org.example.user.Referente;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "organizaciones")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Organizacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nombre;

    @Column(unique = true)
    private String slug;

    @Column(length = 1000)
    private String descripcion;

    private String tipo;

    private String direccion;

    private Double latitud;

    private Double longitud;

    @Column(nullable = false)
    private Boolean validada = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "administrador_id")
    private Administrador validadoPor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "referente_id")
    private Referente referente;

    @OneToMany(mappedBy = "organizacion", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Necesidad> necesidades = new ArrayList<>();
}
