package org.example.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.user.Administrador;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer {

    private final UsuarioRepository usuarioRepository;
    private final OrganizacionRepository organizacionRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    @Value("${SUPER_ADMIN_EMAIL:admin@hornero.ar}")
    private String superAdminEmail;

    @Value("${SUPER_ADMIN_PASSWORD:Admin123!}")
    private String superAdminPassword;

    @PostConstruct
    public void init() {
        seedAdmin();
        seedUsers();
        seedOrganizaciones();
    }

    private void seedAdmin() {
        if (usuarioRepository.findByEmail(superAdminEmail).isPresent()) {
            log.info("Admin already exists, skipping");
            return;
        }

        Administrador admin = new Administrador();
        admin.setNombre("Admin Hornero");
        admin.setEmail(superAdminEmail);
        admin.setPassword(passwordEncoder.encode(superAdminPassword));
        admin.setActivo(true);

        usuarioRepository.save(admin);
        log.info("Seeded super admin: {}", superAdminEmail);
    }

    private void seedUsers() {
        if (usuarioRepository.findByEmail("referente@hornero.ar").isEmpty()) {
            Referente referente = new Referente();
            referente.setNombre("Referente Hornero");
            referente.setEmail("referente@hornero.ar");
            referente.setPassword(passwordEncoder.encode("Ref123!"));
            referente.setActivo(true);
            usuarioRepository.save(referente);
            log.info("Seeded referente@hornero.ar");
        }

        if (usuarioRepository.findByEmail("donante@hornero.ar").isEmpty()) {
            Donante donante = new Donante();
            donante.setNombre("Donante Hornero");
            donante.setEmail("donante@hornero.ar");
            donante.setPassword(passwordEncoder.encode("Don123!"));
            donante.setActivo(true);
            usuarioRepository.save(donante);
            log.info("Seeded donante@hornero.ar");
        }
    }

    private void seedOrganizaciones() {
        if (organizacionRepository.count() > 0) {
            log.info("Orgs already seeded, skipping");
            return;
        }

        Optional<Usuario> referenteOpt = usuarioRepository.findByEmail("referente@hornero.ar");
        Optional<Usuario> adminOpt = usuarioRepository.findByEmail(superAdminEmail);

        if (referenteOpt.isEmpty() || adminOpt.isEmpty()) {
            log.warn("Seed users not found, skipping org seed");
            return;
        }

        Referente referente = (Referente) referenteOpt.get();
        Administrador admin = (Administrador) adminOpt.get();

        Organizacion org1 = new Organizacion();
        org1.setNombre("Comedor La Esperanza");
        org1.setSlug("comedor-la-esperanza");
        org1.setTipo("Comedor");
        org1.setDescripcion("Comedor comunitario que brinda almuerzo y cena a familias en situación de vulnerabilidad. Atiende más de 80 personas por día.");
        org1.setDireccion("Bv. Los Andes 1230, Córdoba");
        org1.setLatitud(-31.4167);
        org1.setLongitud(-64.1833);
        org1.setValidada(true);
        org1.setReferente(referente);
        org1.setValidadoPor(admin);

        Organizacion org2 = new Organizacion();
        org2.setNombre("Merendero Corazón Solidario");
        org2.setSlug("merendero-corazon-solidario");
        org2.setTipo("Merendero");
        org2.setDescripcion("Merendero que asiste a niños y adolescentes con merienda diaria y apoyo escolar. Funciona de lunes a viernes en el barrio.");
        org2.setDireccion("Av. Colón 450, Córdoba");
        org2.setLatitud(-31.4089);
        org2.setLongitud(-64.1953);
        org2.setValidada(true);
        org2.setReferente(referente);
        org2.setValidadoPor(admin);

        Organizacion org3 = new Organizacion();
        org3.setNombre("Ropero Comunitario Norte");
        org3.setSlug("ropero-comunitario-norte");
        org3.setTipo("Ropero");
        org3.setDescripcion("Ropero solidario que recibe y redistribuye ropa en buen estado para familias del sector norte de la ciudad.");
        org3.setDireccion("Calle Tucumán 780, Córdoba");
        org3.setLatitud(-31.3985);
        org3.setLongitud(-64.1901);
        org3.setValidada(true);
        org3.setReferente(referente);
        org3.setValidadoPor(admin);

        organizacionRepository.saveAll(List.of(org1, org2, org3));
        log.info("Seeded 3 organizations");
    }
}
