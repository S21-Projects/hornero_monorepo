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
                coalesce(o.origen, org.example.domain.OrigenOrganizacion.PLATAFORMA), o.latitud, o.longitud)
            from Organizacion o
            where o.estado in :estados and o.latitud is not null and o.longitud is not null
            order by o.id
            """)
    List<org.example.organizacion.dto.OrganizacionMapaResponse> findMapa(
            @org.springframework.data.repository.query.Param("estados") java.util.Collection<EstadoOrganizacion> estados);

    List<Organizacion> findByReferente_Id(Long referenteId);

    Optional<Organizacion> findByIdAndReferente_Id(Long id, Long referenteId);

    long countByReferente_IdAndEstadoNot(Long referenteId, EstadoOrganizacion estado);

    List<Organizacion> findByReferenteIsNull();

    Optional<Organizacion> findBySlug(String slug);

    boolean existsBySlug(String slug);
}
