package org.example.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.user.Administrador;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer {

    private final UsuarioRepository usuarioRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    @PostConstruct
    public void init() {
        if (usuarioRepository.count() > 0) {
            log.info("Database already has users — skipping seed data");
            return;
        }

        log.info("Seeding initial users...");

        Administrador admin = new Administrador();
        admin.setNombre("Admin Hornero");
        admin.setEmail("admin@hornero.ar");
        admin.setPassword(passwordEncoder.encode("Admin123!"));
        admin.setActivo(true);

        Referente referente = new Referente();
        referente.setNombre("Referente Hornero");
        referente.setEmail("referente@hornero.ar");
        referente.setPassword(passwordEncoder.encode("Ref123!"));
        referente.setActivo(true);

        Donante donante = new Donante();
        donante.setNombre("Donante Hornero");
        donante.setEmail("donante@hornero.ar");
        donante.setPassword(passwordEncoder.encode("Don123!"));
        donante.setActivo(true);

        usuarioRepository.save(admin);
        usuarioRepository.save(referente);
        usuarioRepository.save(donante);

        log.info("Seed complete: admin@hornero.ar / referente@hornero.ar / donante@hornero.ar");
    }
}
