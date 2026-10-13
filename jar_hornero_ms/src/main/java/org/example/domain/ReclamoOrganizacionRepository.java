package org.example.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReclamoOrganizacionRepository extends JpaRepository<ReclamoOrganizacion, Long> {

    Page<ReclamoOrganizacion> findByEstado(EstadoReclamo estado, Pageable pageable);

    List<ReclamoOrganizacion> findByReferente_IdOrderByCreadoEnDescIdDesc(Long referenteId);

    /** Every claim filed by a user, any state: used by the anonymization flow. */
    List<ReclamoOrganizacion> findByReferente_Id(Long referenteId);

    List<ReclamoOrganizacion> findByOrganizacion_IdAndEstado(Long organizacionId, EstadoReclamo estado);

    List<ReclamoOrganizacion> findByReferente_IdAndEstado(Long referenteId, EstadoReclamo estado);

    boolean existsByOrganizacion_IdAndReferente_IdAndEstado(Long organizacionId, Long referenteId, EstadoReclamo estado);

    /** Authorizes an evidence file: the key must be bound to a row of this claimant. */
    @org.springframework.data.jpa.repository.Query("""
            select count(r) > 0 from ReclamoOrganizacion r join r.evidenciaKeys k
            where r.organizacion.id = :organizacionId and r.referente.id = :referenteId and k = :objectKey
            """)
    boolean existeEvidenciaDeReferente(
            @org.springframework.data.repository.query.Param("organizacionId") Long organizacionId,
            @org.springframework.data.repository.query.Param("referenteId") Long referenteId,
            @org.springframework.data.repository.query.Param("objectKey") String objectKey);
}
