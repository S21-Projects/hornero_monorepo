package org.example.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrganizacionRepository;
import org.example.domain.TipoEventoOrganizacion;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * AD-7: idempotent, guarded by {@code nivel IS NULL}, seeds a {@code MIGRACION_INICIAL} genesis
 * event for every pre-existing row so the replay invariant (AD-3) holds for legacy data too. Same
 * lifecycle timing as the shipped {@code DataInitializer} — runs once at boot, safe to re-run.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AcreditacionBackfill implements ApplicationRunner {

    private final OrganizacionRepository organizacionRepository;
    private final OrganizacionEventoRepository eventoRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Organizacion> pendientes = organizacionRepository.findAll().stream()
                .filter(org -> org.getNivel() == null)
                .toList();

        for (Organizacion organizacion : pendientes) {
            backfillUna(organizacion);
        }

        log.info("Acreditación backfill complete (idempotent): {} row(s) migrated", pendientes.size());
    }

    private void backfillUna(Organizacion organizacion) {
        EstadoOrganizacion estadoActual = organizacion.getEstado();

        NivelAcreditacion nivelAsignado =
                estadoActual == EstadoOrganizacion.APROBADA ? NivelAcreditacion.N1 : NivelAcreditacion.N0;

        organizacion.setNivel(nivelAsignado);
        organizacionRepository.save(organizacion);

        eventoRepository.save(OrganizacionEvento.de(
                organizacion, TipoEventoOrganizacion.MIGRACION_INICIAL, null,
                "Backfill: estado " + estadoActual, NivelAcreditacion.N0, nivelAsignado));

        if (estadoActual == EstadoOrganizacion.RECHAZADA) {
            eventoRepository.save(OrganizacionEvento.de(
                    organizacion, TipoEventoOrganizacion.REGISTRO_RECHAZADO, null,
                    "Backfill: previously RECHAZADA", NivelAcreditacion.N0, null));
        }
    }
}
