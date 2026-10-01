package org.example.config;

import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.TipoOrganizacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.example.domain.UnidadArticulo;
import org.example.user.Administrador;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer {

    private final UsuarioRepository usuarioRepository;
    private final OrganizacionRepository organizacionRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final NecesidadRepository necesidadRepository;
    private final DonacionRepository donacionRepository;
    private final ArticuloRepository articuloRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Value("${SUPER_ADMIN_EMAIL:admin@hornero.ar}")
    private String superAdminEmail;

    @Value("${SUPER_ADMIN_PASSWORD:Admin123!}")
    private String superAdminPassword;

    @PostConstruct
    public void init() {
        seedAdmin();
        seedUsers();
        seedOrganizaciones();
        seedArticulos();
        seedNecesidades();
        seedDonaciones();
    }

    /**
     * Feature catalogo-articulos, work unit A (C1-C3/C14's seed carve-out): the initial fixed
     * catalog, idempotent by {@code nombre} so re-running {@link #init()} (e.g. every app restart)
     * never duplicates rows. Covers all three {@link CategoriaAlimento} values with realistic
     * items and a sensible {@link UnidadArticulo} per item (decision 3).
     */
    private void seedArticulos() {
        record Semilla(String nombre, CategoriaAlimento categoria, UnidadArticulo unidad) {}

        List<Semilla> catalogo = List.of(
                // NO_PERECEDERO
                new Semilla("Arroz", CategoriaAlimento.NO_PERECEDERO, UnidadArticulo.KG),
                new Semilla("Fideos", CategoriaAlimento.NO_PERECEDERO, UnidadArticulo.PAQUETE),
                new Semilla("Legumbres", CategoriaAlimento.NO_PERECEDERO, UnidadArticulo.KG),
                new Semilla("Harina", CategoriaAlimento.NO_PERECEDERO, UnidadArticulo.KG),
                new Semilla("Aceite", CategoriaAlimento.NO_PERECEDERO, UnidadArticulo.LITRO),
                new Semilla("Azúcar", CategoriaAlimento.NO_PERECEDERO, UnidadArticulo.KG),
                new Semilla("Conservas", CategoriaAlimento.NO_PERECEDERO, UnidadArticulo.UNIDAD),
                // REFRIGERADO
                new Semilla("Leche", CategoriaAlimento.REFRIGERADO, UnidadArticulo.LITRO),
                new Semilla("Yogur", CategoriaAlimento.REFRIGERADO, UnidadArticulo.UNIDAD),
                new Semilla("Queso", CategoriaAlimento.REFRIGERADO, UnidadArticulo.KG),
                // CONGELADO
                new Semilla("Carne", CategoriaAlimento.CONGELADO, UnidadArticulo.KG),
                new Semilla("Pollo", CategoriaAlimento.CONGELADO, UnidadArticulo.KG),
                new Semilla("Verduras congeladas", CategoriaAlimento.CONGELADO, UnidadArticulo.PAQUETE)
        );

        int creados = 0;
        for (Semilla semilla : catalogo) {
            if (articuloRepository.findByNombreIgnoreCase(semilla.nombre()).isPresent()) {
                continue;
            }
            Articulo a = new Articulo();
            a.setNombre(semilla.nombre());
            a.setCategoria(semilla.categoria());
            a.setUnidad(semilla.unidad());
            a.setActivo(true);
            articuloRepository.save(a);
            creados++;
        }
        if (creados > 0) {
            log.info("Seeded {} articulo(s) in the catalog", creados);
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void backfillEstado() {
        backfillTipo();

        entityManager.createNativeQuery(
                "UPDATE organizaciones SET estado = 'APROBADA' WHERE validada = true AND estado IS NULL"
        ).executeUpdate();
        entityManager.createNativeQuery(
                "UPDATE organizaciones SET estado = 'PENDIENTE' WHERE (validada IS NULL OR validada = false) AND estado IS NULL"
        ).executeUpdate();
        log.info("Backfill estado complete (idempotent)");
    }

    private void backfillTipo() {
        entityManager.createNativeQuery(
                "UPDATE organizaciones SET tipo = 'COMEDOR' WHERE tipo = 'Comedor'"
        ).executeUpdate();
        entityManager.createNativeQuery(
                "UPDATE organizaciones SET tipo = 'MERENDERO' WHERE tipo = 'Merendero'"
        ).executeUpdate();
        entityManager.createNativeQuery(
                "UPDATE organizaciones SET tipo = 'ROPERO' WHERE tipo = 'Ropero'"
        ).executeUpdate();
        entityManager.createNativeQuery(
                "UPDATE organizaciones SET tipo = 'OTRO' WHERE tipo IS NOT NULL AND tipo NOT IN ('COMEDOR','COPITA','ROPERO','MERENDERO','OTRO')"
        ).executeUpdate();
        log.info("Backfill tipo complete (idempotent)");
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
        admin.setEmailVerificado(true);

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
            referente.setEmailVerificado(true);
            usuarioRepository.save(referente);
            log.info("Seeded referente@hornero.ar");
        }

        if (usuarioRepository.findByEmail("referente2@hornero.ar").isEmpty()) {
            Referente referente2 = new Referente();
            referente2.setNombre("Lucía Fernández");
            referente2.setEmail("referente2@hornero.ar");
            referente2.setPassword(passwordEncoder.encode("Ref123!"));
            referente2.setActivo(true);
            referente2.setEmailVerificado(true);
            usuarioRepository.save(referente2);
            log.info("Seeded referente2@hornero.ar");
        }

        if (usuarioRepository.findByEmail("referente3@hornero.ar").isEmpty()) {
            Referente referente3 = new Referente();
            referente3.setNombre("Mateo Gómez");
            referente3.setEmail("referente3@hornero.ar");
            referente3.setPassword(passwordEncoder.encode("Ref123!"));
            referente3.setActivo(true);
            referente3.setEmailVerificado(true);
            usuarioRepository.save(referente3);
            log.info("Seeded referente3@hornero.ar");
        }

        if (usuarioRepository.findByEmail("donante@hornero.ar").isEmpty()) {
            Donante donante = new Donante();
            donante.setNombre("Donante Hornero");
            donante.setEmail("donante@hornero.ar");
            donante.setPassword(passwordEncoder.encode("Don123!"));
            donante.setActivo(true);
            donante.setEmailVerificado(true);
            usuarioRepository.save(donante);
            log.info("Seeded donante@hornero.ar");
        }

        if (usuarioRepository.findByEmail("donante2@hornero.ar").isEmpty()) {
            Donante donante2 = new Donante();
            donante2.setNombre("María Belén Ríos");
            donante2.setEmail("donante2@hornero.ar");
            donante2.setPassword(passwordEncoder.encode("Don123!"));
            donante2.setActivo(true);
            donante2.setEmailVerificado(true);
            usuarioRepository.save(donante2);
            log.info("Seeded donante2@hornero.ar");
        }
    }

    private void seedOrganizaciones() {
        if (organizacionRepository.count() > 0) {
            log.info("Orgs already seeded, skipping");
            return;
        }

        Optional<Usuario> referenteOpt  = usuarioRepository.findByEmail("referente@hornero.ar");
        Optional<Usuario> referente2Opt = usuarioRepository.findByEmail("referente2@hornero.ar");
        Optional<Usuario> referente3Opt = usuarioRepository.findByEmail("referente3@hornero.ar");
        Optional<Usuario> adminOpt      = usuarioRepository.findByEmail(superAdminEmail);

        if (referenteOpt.isEmpty() || referente2Opt.isEmpty() || referente3Opt.isEmpty() || adminOpt.isEmpty()) {
            log.warn("Seed users not found, skipping org seed");
            return;
        }

        Referente referente  = (Referente) referenteOpt.get();
        Referente referente2 = (Referente) referente2Opt.get();
        Referente referente3 = (Referente) referente3Opt.get();
        Administrador admin  = (Administrador) adminOpt.get();

        Organizacion org1 = new Organizacion();
        org1.setNombre("Comedor La Esperanza");
        org1.setSlug("comedor-la-esperanza");
        org1.setTipo(TipoOrganizacion.COMEDOR);
        org1.setDescripcion("Comedor comunitario que brinda almuerzo y cena a familias en situación de vulnerabilidad. Atiende más de 80 personas por día.");
        org1.setDireccion("Bv. Los Andes 1230, Córdoba");
        org1.setLatitud(-31.4167);
        org1.setLongitud(-64.1833);
        org1.setEstado(EstadoOrganizacion.APROBADA);
        org1.setReferente(referente);
        org1.setValidadoPor(admin);

        Organizacion org2 = new Organizacion();
        org2.setNombre("Merendero Corazón Solidario");
        org2.setSlug("merendero-corazon-solidario");
        org2.setTipo(TipoOrganizacion.MERENDERO);
        org2.setDescripcion("Merendero que asiste a niños y adolescentes con merienda diaria y apoyo escolar. Funciona de lunes a viernes en el barrio.");
        org2.setDireccion("Av. Colón 450, Córdoba");
        org2.setLatitud(-31.4089);
        org2.setLongitud(-64.1953);
        org2.setEstado(EstadoOrganizacion.APROBADA);
        org2.setReferente(referente2);
        org2.setValidadoPor(admin);

        Organizacion org3 = new Organizacion();
        org3.setNombre("Ropero Comunitario Norte");
        org3.setSlug("ropero-comunitario-norte");
        org3.setTipo(TipoOrganizacion.ROPERO);
        org3.setDescripcion("Ropero solidario que recibe y redistribuye ropa en buen estado para familias del sector norte de la ciudad.");
        org3.setDireccion("Calle Tucumán 780, Córdoba");
        org3.setLatitud(-31.3985);
        org3.setLongitud(-64.1901);
        org3.setEstado(EstadoOrganizacion.APROBADA);
        org3.setReferente(referente3);
        org3.setValidadoPor(admin);

        organizacionRepository.saveAll(List.of(org1, org2, org3));
        log.info("Seeded 3 organizations (one referente per org)");
    }

    private void seedNecesidades() {
        if (necesidadRepository.count() > 0) return;

        List<Organizacion> orgs = organizacionRepository.findAll();
        if (orgs.size() < 3) return;

        // Org 0 — Comedor La Esperanza (3 needs)
        Necesidad n1 = new Necesidad();
        n1.setDescripcion("Leche entera para la copa de leche");
        n1.setPrioridad(PrioridadNecesidad.URGENTE);
        n1.setEstado(EstadoNecesidad.ABIERTA);
        n1.setFechaPublicacion(LocalDate.now());
        n1.setFechaVencimiento(LocalDate.now().plusDays(14));
        n1.setOrganizacion(orgs.get(0));

        Necesidad n1b = new Necesidad();
        n1b.setDescripcion("Aceite y harina para el almuerzo diario");
        n1b.setPrioridad(PrioridadNecesidad.MEDIA);
        n1b.setEstado(EstadoNecesidad.ABIERTA);
        n1b.setFechaPublicacion(LocalDate.now().minusDays(3));
        n1b.setFechaVencimiento(LocalDate.now().plusDays(20));
        n1b.setOrganizacion(orgs.get(0));

        Necesidad n1c = new Necesidad();
        n1c.setDescripcion("Utensilios de cocina y tablas de corte");
        n1c.setPrioridad(PrioridadNecesidad.NORMAL);
        n1c.setEstado(EstadoNecesidad.ABIERTA);
        n1c.setFechaPublicacion(LocalDate.now().minusDays(7));
        n1c.setOrganizacion(orgs.get(0));

        // Org 1 — Merendero Corazón Solidario (3 needs)
        Necesidad n2 = new Necesidad();
        n2.setDescripcion("Ropa de invierno para niños talle 4-8");
        n2.setPrioridad(PrioridadNecesidad.URGENTE);
        n2.setEstado(EstadoNecesidad.ABIERTA);
        n2.setFechaPublicacion(LocalDate.now().minusDays(5));
        n2.setFechaVencimiento(LocalDate.now().plusDays(10));
        n2.setOrganizacion(orgs.get(1));

        Necesidad n2b = new Necesidad();
        n2b.setDescripcion("Útiles escolares para apoyo educativo");
        n2b.setPrioridad(PrioridadNecesidad.MEDIA);
        n2b.setEstado(EstadoNecesidad.EN_PROGRESO);
        n2b.setFechaPublicacion(LocalDate.now().minusDays(10));
        n2b.setOrganizacion(orgs.get(1));

        Necesidad n2c = new Necesidad();
        n2c.setDescripcion("Mesas y sillas plegables para el salón");
        n2c.setPrioridad(PrioridadNecesidad.NORMAL);
        n2c.setEstado(EstadoNecesidad.ABIERTA);
        n2c.setFechaPublicacion(LocalDate.now().minusDays(15));
        n2c.setOrganizacion(orgs.get(1));

        // Org 2 — Ropero Comunitario Norte (3 needs)
        Necesidad n3 = new Necesidad();
        n3.setDescripcion("Fideos y arroz para el mes");
        n3.setPrioridad(PrioridadNecesidad.NORMAL);
        n3.setEstado(EstadoNecesidad.ABIERTA);
        n3.setFechaPublicacion(LocalDate.now().minusDays(2));
        n3.setFechaVencimiento(LocalDate.now().plusDays(30));
        n3.setOrganizacion(orgs.get(2));

        Necesidad n3b = new Necesidad();
        n3b.setDescripcion("Bolsas grandes para clasificar ropa donada");
        n3b.setPrioridad(PrioridadNecesidad.URGENTE);
        n3b.setEstado(EstadoNecesidad.ABIERTA);
        n3b.setFechaPublicacion(LocalDate.now().minusDays(1));
        n3b.setFechaVencimiento(LocalDate.now().plusDays(7));
        n3b.setOrganizacion(orgs.get(2));

        Necesidad n3c = new Necesidad();
        n3c.setDescripcion("Perchas y estantes para exhibición de ropa");
        n3c.setPrioridad(PrioridadNecesidad.MEDIA);
        n3c.setEstado(EstadoNecesidad.ABIERTA);
        n3c.setFechaPublicacion(LocalDate.now().minusDays(8));
        n3c.setOrganizacion(orgs.get(2));

        necesidadRepository.saveAll(List.of(n1, n1b, n1c, n2, n2b, n2c, n3, n3b, n3c));
        log.info("Seeded 9 necesidades (3 per org)");
    }

    private void seedDonaciones() {
        if (donacionRepository.count() > 0) return;

        List<Necesidad> necesidades = necesidadRepository.findAll();
        if (necesidades.size() < 9) return;

        Optional<Usuario> donanteOpt = usuarioRepository.findByEmail("donante@hornero.ar");
        Optional<Usuario> donante2Opt = usuarioRepository.findByEmail("donante2@hornero.ar");
        if (donanteOpt.isEmpty() || donante2Opt.isEmpty()) return;
        Donante donante = (Donante) donanteOpt.get();
        Donante donante2 = (Donante) donante2Opt.get();

        // Org 0 (necesidades 0, 1, 2)
        Donacion d1 = new Donacion();
        d1.setFechaOferta(LocalDate.now());
        d1.setEstado(EstadoDonacion.OFRECIDA);
        d1.setObservaciones("Puedo traer 10 litros esta semana");
        d1.setDonante(donante);
        d1.setNecesidad(necesidades.get(0));

        Donacion d1b = new Donacion();
        d1b.setFechaOferta(LocalDate.now().minusDays(1));
        d1b.setEstado(EstadoDonacion.EN_CAMINO);
        d1b.setObservaciones("Aceite girasol x 4 botellas");
        d1b.setDonante(donante2);
        d1b.setNecesidad(necesidades.get(1));

        Donacion d1c = new Donacion();
        d1c.setFechaOferta(LocalDate.now().minusDays(5));
        d1c.setFechaEntrega(LocalDate.now().minusDays(1));
        d1c.setEstado(EstadoDonacion.ENTREGADA);
        d1c.setObservaciones("Tabla de corte y cuchillos donados");
        d1c.setDonante(donante);
        d1c.setNecesidad(necesidades.get(2));

        // Org 1 (necesidades 3, 4, 5)
        Donacion d2 = new Donacion();
        d2.setFechaOferta(LocalDate.now().minusDays(3));
        d2.setEstado(EstadoDonacion.EN_CAMINO);
        d2.setObservaciones("Ropa de mis hijos en buen estado");
        d2.setDonante(donante);
        d2.setNecesidad(necesidades.get(3));

        Donacion d2b = new Donacion();
        d2b.setFechaOferta(LocalDate.now().minusDays(7));
        d2b.setFechaEntrega(LocalDate.now().minusDays(2));
        d2b.setEstado(EstadoDonacion.ENTREGADA);
        d2b.setObservaciones("Cuadernos y lápices para 15 chicos");
        d2b.setDonante(donante2);
        d2b.setNecesidad(necesidades.get(4));

        Donacion d2c = new Donacion();
        d2c.setFechaOferta(LocalDate.now().minusDays(2));
        d2c.setEstado(EstadoDonacion.OFRECIDA);
        d2c.setObservaciones("Tengo 4 sillas plegables para donar");
        d2c.setDonante(donante);
        d2c.setNecesidad(necesidades.get(5));

        // Org 2 (necesidades 6, 7, 8)
        Donacion d3 = new Donacion();
        d3.setFechaOferta(LocalDate.now().minusDays(10));
        d3.setFechaEntrega(LocalDate.now().minusDays(2));
        d3.setEstado(EstadoDonacion.ENTREGADA);
        d3.setObservaciones("3 kg de fideos y 2 kg de arroz");
        d3.setDonante(donante);
        d3.setNecesidad(necesidades.get(6));

        Donacion d3b = new Donacion();
        d3b.setFechaOferta(LocalDate.now().minusDays(1));
        d3b.setEstado(EstadoDonacion.OFRECIDA);
        d3b.setObservaciones("Tengo bolsas de consorcio grandes disponibles");
        d3b.setDonante(donante2);
        d3b.setNecesidad(necesidades.get(7));

        Donacion d3c = new Donacion();
        d3c.setFechaOferta(LocalDate.now().minusDays(4));
        d3c.setEstado(EstadoDonacion.EN_CAMINO);
        d3c.setObservaciones("Perchas metálicas x 50 unidades");
        d3c.setDonante(donante);
        d3c.setNecesidad(necesidades.get(8));

        donacionRepository.saveAll(List.of(d1, d1b, d1c, d2, d2b, d2c, d3, d3b, d3c));
        log.info("Seeded 9 donaciones (3 per org)");
    }
}
