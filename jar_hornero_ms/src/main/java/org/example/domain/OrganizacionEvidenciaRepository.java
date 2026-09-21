package org.example.domain;

import org.springframework.data.repository.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Evidencia rows are also never hard-deleted (only {@code estado} mutates), so — like
 * {@link OrganizacionEventoRepository} (AD-3) — this extends the bare {@link Repository} marker
 * interface rather than {@code JpaRepository}, declaring only {@code save}, {@code findById} and
 * the two finders the service needs. {@code findById} is a read, not an update, so it does not
 * weaken the append-only guarantee the reflection test in
 * {@code OrganizacionEvidenciaRepositoryTest} enforces.
 */
@org.springframework.stereotype.Repository
public interface OrganizacionEvidenciaRepository extends Repository<OrganizacionEvidencia, Long> {

    OrganizacionEvidencia save(OrganizacionEvidencia evidencia);

    Optional<OrganizacionEvidencia> findById(Long id);

    List<OrganizacionEvidencia> findByOrganizacion_Id(Long organizacionId);

    List<OrganizacionEvidencia> findByOrganizacion_IdAndRequisitoAndEstadoNot(
            Long organizacionId, RequisitoAcreditacion requisito, EstadoEvidencia estadoDistinto);
}
