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
import org.example.domain.DonacionLinea;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.TipoOrganizacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadArticulo;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
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

    /**
     * Feature catalogo-articulos, work unit I (C14): every seeded necesidad carries 1-3 articulos
     * and a categoria derived from them (decision 6 — never hand-entered, and the ronda solver
     * excludes a zero-articulo necesidad per {@code RondaService.esCandidataElegible}). Decision 1
     * ("current data is not real") also means a seeded description must actually be a food
     * request — the platform's necesidades are always food (every {@code Necesidad.categoria} is
     * a {@link CategoriaAlimento}) — so the old non-food placeholders (clothing, furniture,
     * school supplies) are rewritten here, not just left articulo-less.
     */
    private void seedNecesidades() {
        if (necesidadRepository.count() > 0) return;

        List<Organizacion> orgs = organizacionRepository.findAll();
        if (orgs.size() < 3) return;

        // Org 0 — Comedor La Esperanza (3 needs)
        Necesidad n1 = necesidad("Leche entera para la copa de leche", PrioridadNecesidad.URGENTE,
                EstadoNecesidad.ABIERTA, LocalDate.now(), LocalDate.now().plusDays(14), orgs.get(0),
                "Leche");

        Necesidad n1b = necesidad("Aceite y harina para el almuerzo diario", PrioridadNecesidad.MEDIA,
                EstadoNecesidad.ABIERTA, LocalDate.now().minusDays(3), LocalDate.now().plusDays(20), orgs.get(0),
                "Aceite", "Harina");

        Necesidad n1c = necesidad("Carne y pollo para el guiso semanal", PrioridadNecesidad.NORMAL,
                EstadoNecesidad.ABIERTA, LocalDate.now().minusDays(7), null, orgs.get(0),
                "Carne", "Pollo");

        // Org 1 — Merendero Corazón Solidario (3 needs)
        Necesidad n2 = necesidad("Yogur y queso para la merienda de los chicos", PrioridadNecesidad.URGENTE,
                EstadoNecesidad.ABIERTA, LocalDate.now().minusDays(5), LocalDate.now().plusDays(10), orgs.get(1),
                "Yogur", "Queso");

        Necesidad n2b = necesidad("Fideos y conservas para la merienda reforzada", PrioridadNecesidad.MEDIA,
                EstadoNecesidad.EN_PROGRESO, LocalDate.now().minusDays(10), null, orgs.get(1),
                "Fideos", "Conservas");

        Necesidad n2c = necesidad("Azúcar y legumbres para completar la merienda", PrioridadNecesidad.NORMAL,
                EstadoNecesidad.ABIERTA, LocalDate.now().minusDays(15), null, orgs.get(1),
                "Azúcar", "Legumbres");

        // Org 2 — Ropero Comunitario Norte (3 needs — also runs a food pantry for volunteers)
        Necesidad n3 = necesidad("Fideos y arroz para el mes", PrioridadNecesidad.NORMAL,
                EstadoNecesidad.ABIERTA, LocalDate.now().minusDays(2), LocalDate.now().plusDays(30), orgs.get(2),
                "Fideos", "Arroz");

        Necesidad n3b = necesidad("Verduras congeladas para los voluntarios", PrioridadNecesidad.URGENTE,
                EstadoNecesidad.ABIERTA, LocalDate.now().minusDays(1), LocalDate.now().plusDays(7), orgs.get(2),
                "Verduras congeladas");

        Necesidad n3c = necesidad("Leche y yogur para la merienda de voluntarios", PrioridadNecesidad.MEDIA,
                EstadoNecesidad.ABIERTA, LocalDate.now().minusDays(8), null, orgs.get(2),
                "Leche", "Yogur");

        necesidadRepository.saveAll(List.of(n1, n1b, n1c, n2, n2b, n2c, n3, n3b, n3c));
        log.info("Seeded 9 necesidades (3 per org), each with its requested articulos");
    }

    /**
     * Builds one seeded {@link Necesidad} with its {@link NecesidadArticulo} selection and the
     * categoria derived from it (mirrors {@code NecesidadService.crear}'s derivation, decision 6).
     */
    private Necesidad necesidad(String descripcion, PrioridadNecesidad prioridad, EstadoNecesidad estado,
                                 LocalDate fechaPublicacion, LocalDate fechaVencimiento, Organizacion organizacion,
                                 String... nombresArticulos) {
        Necesidad n = new Necesidad();
        n.setDescripcion(descripcion);
        n.setPrioridad(prioridad);
        n.setEstado(estado);
        n.setFechaPublicacion(fechaPublicacion);
        n.setFechaVencimiento(fechaVencimiento);
        n.setOrganizacion(organizacion);

        List<NecesidadArticulo> articulos = new java.util.ArrayList<>();
        List<CategoriaAlimento> categorias = new java.util.ArrayList<>();
        for (String nombre : nombresArticulos) {
            Articulo articulo = articuloPorNombre(nombre);
            NecesidadArticulo na = new NecesidadArticulo();
            na.setArticulo(articulo);
            na.setNecesidad(n);
            articulos.add(na);
            categorias.add(articulo.getCategoria());
        }
        n.setArticulos(articulos);
        n.setCategoria(CategoriaAlimento.masExigente(categorias));
        return n;
    }

    private Articulo articuloPorNombre(String nombre) {
        return articuloRepository.findByNombreIgnoreCase(nombre)
                .orElseThrow(() -> new IllegalStateException(
                        "Seed articulo not found: " + nombre + " — seedArticulos() must run before seedNecesidades()/seedDonaciones()"));
    }

    /**
     * Feature catalogo-articulos, work unit I (C14): every seeded donación carries 1-2
     * {@link DonacionLinea}s and a categoria derived from them (decision 4/5), and — mirroring
     * the DIRECTA compatibility rule in {@code DonacionService.crear} — each donación offers at
     * least one articulo its target necesidad actually requested, so the seed stays coherent with
     * that rule even though it bypasses the service layer.
     */
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
        Donacion d1 = donacion(LocalDate.now(), null, EstadoDonacion.OFRECIDA,
                "Puedo traer 10 litros esta semana", donante, necesidades.get(0), Map.of("Leche", "10"));

        Donacion d1b = donacion(LocalDate.now().minusDays(1), null, EstadoDonacion.EN_CAMINO,
                "Aceite girasol x 4 botellas", donante2, necesidades.get(1), Map.of("Aceite", "4"));

        Donacion d1c = donacion(LocalDate.now().minusDays(5), LocalDate.now().minusDays(1), EstadoDonacion.ENTREGADA,
                "Pollo para el guiso de la semana", donante, necesidades.get(2), Map.of("Pollo", "5"));

        // Org 1 (necesidades 3, 4, 5)
        Donacion d2 = donacion(LocalDate.now().minusDays(3), null, EstadoDonacion.EN_CAMINO,
                "Yogures individuales para la merienda", donante, necesidades.get(3), Map.of("Yogur", "12"));

        Donacion d2b = donacion(LocalDate.now().minusDays(7), LocalDate.now().minusDays(2), EstadoDonacion.ENTREGADA,
                "Latas de conserva variadas", donante2, necesidades.get(4), Map.of("Conservas", "15"));

        Donacion d2c = donacion(LocalDate.now().minusDays(2), null, EstadoDonacion.OFRECIDA,
                "Tengo 4 kg de azúcar para donar", donante, necesidades.get(5), Map.of("Azúcar", "4"));

        // Org 2 (necesidades 6, 7, 8)
        Donacion d3 = donacion(LocalDate.now().minusDays(10), LocalDate.now().minusDays(2), EstadoDonacion.ENTREGADA,
                "3 kg de fideos y 2 kg de arroz", donante, necesidades.get(6),
                Map.of("Fideos", "3", "Arroz", "2"));

        Donacion d3b = donacion(LocalDate.now().minusDays(1), null, EstadoDonacion.OFRECIDA,
                "Verduras congeladas para los voluntarios", donante2, necesidades.get(7), Map.of("Verduras congeladas", "5"));

        Donacion d3c = donacion(LocalDate.now().minusDays(4), null, EstadoDonacion.EN_CAMINO,
                "Leche larga vida x 6 litros", donante, necesidades.get(8), Map.of("Leche", "6"));

        donacionRepository.saveAll(List.of(d1, d1b, d1c, d2, d2b, d2c, d3, d3b, d3c));
        log.info("Seeded 9 donaciones (3 per org), each with its lineas");
    }

    /**
     * Builds one seeded DIRECTA {@link Donacion} with its {@link DonacionLinea}s and the categoria
     * derived from them (mirrors {@code DonacionService.crear}'s derivation, decision 5).
     */
    private Donacion donacion(LocalDate fechaOferta, LocalDate fechaEntrega, EstadoDonacion estado,
                               String observaciones, Donante donante, Necesidad necesidad,
                               Map<String, String> cantidadesPorArticulo) {
        Donacion d = new Donacion();
        d.setFechaOferta(fechaOferta);
        d.setFechaEntrega(fechaEntrega);
        d.setEstado(estado);
        d.setObservaciones(observaciones);
        d.setDonante(donante);
        d.setNecesidad(necesidad);

        List<DonacionLinea> lineas = new java.util.ArrayList<>();
        List<CategoriaAlimento> categorias = new java.util.ArrayList<>();
        for (Map.Entry<String, String> entry : cantidadesPorArticulo.entrySet()) {
            Articulo articulo = articuloPorNombre(entry.getKey());
            DonacionLinea linea = new DonacionLinea();
            linea.setArticulo(articulo);
            linea.setCantidad(new BigDecimal(entry.getValue()));
            linea.setDonacion(d);
            lineas.add(linea);
            categorias.add(articulo.getCategoria());
        }
        d.setLineas(lineas);
        d.setCategoria(CategoriaAlimento.masExigente(categorias));
        return d;
    }
}
