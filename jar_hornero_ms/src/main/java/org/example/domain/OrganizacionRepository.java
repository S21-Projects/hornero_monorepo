package org.example.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrganizacionRepository extends JpaRepository<Organizacion, Long> {

    List<Organizacion> findByEstado(EstadoOrganizacion estado);

    Page<Organizacion> findByEstado(EstadoOrganizacion estado, Pageable pageable);

    /** Map projection straight to the DTO: no entity (and no lazy referente/validadoPor) is loaded. */
    @org.springframework.data.jpa.repository.Query("""
            select new org.example.organizacion.dto.OrganizacionMapaResponse(
                o.id, o.slug, o.nombre, o.tipo, o.estado,
                coalesce(o.origen, org.example.domain.OrigenOrganizacion.PLATAFORMA), o.latitud, o.longitud,
                (select count(n) from Necesidad n
                  where n.organizacion = o
                    and n.estado in :estadosAbiertos
                    and (n.fechaVencimiento is null or n.fechaVencimiento >= :hoy)))
            from Organizacion o
            where o.estado in :estados and o.latitud is not null and o.longitud is not null
            order by o.id
            """)
    List<org.example.organizacion.dto.OrganizacionMapaResponse> findMapa(
            @org.springframework.data.repository.query.Param("estados") java.util.Collection<EstadoOrganizacion> estados,
            @org.springframework.data.repository.query.Param("estadosAbiertos")
                    java.util.Collection<EstadoNecesidad> estadosAbiertos,
            @org.springframework.data.repository.query.Param("hoy") java.time.LocalDate hoy);

    /**
     * Platform (non-imported) approved organizaciones inside a lat/lng box, the coarse pre-filter of the
     * "already on Hornero" picker; the exact distance is computed in Java (no PostGIS).
     */
    @org.springframework.data.jpa.repository.Query("""
            select o from Organizacion o
            where o.estado = org.example.domain.EstadoOrganizacion.APROBADA
              and coalesce(o.origen, org.example.domain.OrigenOrganizacion.PLATAFORMA)
                  = org.example.domain.OrigenOrganizacion.PLATAFORMA
              and o.latitud between :minLat and :maxLat and o.longitud between :minLng and :maxLng
            """)
    List<Organizacion> findPlataformaAprobadasEnCaja(
            @org.springframework.data.repository.query.Param("minLat") double minLat,
            @org.springframework.data.repository.query.Param("maxLat") double maxLat,
            @org.springframework.data.repository.query.Param("minLng") double minLng,
            @org.springframework.data.repository.query.Param("maxLng") double maxLng);

    /** Organizaciones with coordinates but no census radio yet: the work list of the radio backfill. */
    @org.springframework.data.jpa.repository.Query("""
            select o from Organizacion o
            where o.codigoRadio is null and o.latitud is not null and o.longitud is not null
            order by o.id
            """)
    List<Organizacion> findPendientesDeRadio(Pageable pageable);

    List<Organizacion> findByReferente_Id(Long referenteId);

    Optional<Organizacion> findByIdAndReferente_Id(Long id, Long referenteId);

    long countByReferente_IdAndEstadoNot(Long referenteId, EstadoOrganizacion estado);

    List<Organizacion> findByReferenteIsNull();

    Optional<Organizacion> findBySlug(String slug);

    boolean existsBySlug(String slug);
}
