package org.example.donacion;

import org.example.domain.Donacion;
import org.example.domain.EstadoDonacion;
import org.example.domain.ModalidadDonacion;
import org.example.domain.Necesidad;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AD-4's full derivation table: {@code modalidad × estado × necesidad presence → fase}, the
 * read-only progress step the SPA renders (never re-derived client-side).
 */
class FaseDonacionTest {

    private Donacion donacion(ModalidadDonacion modalidad, EstadoDonacion estado, boolean necesidadPresente) {
        Donacion d = new Donacion();
        d.setModalidad(modalidad);
        d.setEstado(estado);
        d.setNecesidad(necesidadPresente ? new Necesidad() : null);
        return d;
    }

    @Test
    void fondoComun_ofrecida_sinNecesidad_esEnFondo() {
        Donacion d = donacion(ModalidadDonacion.FONDO_COMUN, EstadoDonacion.OFRECIDA, false);
        assertThat(FaseDonacion.de(d)).isEqualTo(FaseDonacion.EN_FONDO);
    }

    @Test
    void fondoComun_ofrecida_conNecesidad_esAsignada() {
        Donacion d = donacion(ModalidadDonacion.FONDO_COMUN, EstadoDonacion.OFRECIDA, true);
        assertThat(FaseDonacion.de(d)).isEqualTo(FaseDonacion.ASIGNADA);
    }

    @Test
    void directa_ofrecida_conNecesidad_esOfrecida() {
        Donacion d = donacion(ModalidadDonacion.DIRECTA, EstadoDonacion.OFRECIDA, true);
        assertThat(FaseDonacion.de(d)).isEqualTo(FaseDonacion.OFRECIDA);
    }

    @Test
    void modalidadNull_esTratadaComoDirecta() {
        Donacion d = donacion(null, EstadoDonacion.OFRECIDA, true);
        assertThat(FaseDonacion.de(d)).isEqualTo(FaseDonacion.OFRECIDA);
    }

    @Test
    void cualquierModalidad_aceptada_esAceptada() {
        assertThat(FaseDonacion.de(donacion(ModalidadDonacion.DIRECTA, EstadoDonacion.ACEPTADA, true)))
                .isEqualTo(FaseDonacion.ACEPTADA);
        assertThat(FaseDonacion.de(donacion(ModalidadDonacion.FONDO_COMUN, EstadoDonacion.ACEPTADA, true)))
                .isEqualTo(FaseDonacion.ACEPTADA);
    }

    @Test
    void cualquierModalidad_enCamino_esEnCamino() {
        assertThat(FaseDonacion.de(donacion(ModalidadDonacion.DIRECTA, EstadoDonacion.EN_CAMINO, true)))
                .isEqualTo(FaseDonacion.EN_CAMINO);
    }

    @Test
    void cualquierModalidad_pendienteConfirmacion_esConfirmando() {
        assertThat(FaseDonacion.de(donacion(ModalidadDonacion.FONDO_COMUN, EstadoDonacion.PENDIENTE_CONFIRMACION, true)))
                .isEqualTo(FaseDonacion.CONFIRMANDO);
    }

    @Test
    void cualquierModalidad_entregada_esEntregada() {
        assertThat(FaseDonacion.de(donacion(ModalidadDonacion.DIRECTA, EstadoDonacion.ENTREGADA, true)))
                .isEqualTo(FaseDonacion.ENTREGADA);
    }

    @Test
    void rechazada_esBannerTerminalRechazada_sinImportarModalidadNiNecesidad() {
        assertThat(FaseDonacion.de(donacion(ModalidadDonacion.DIRECTA, EstadoDonacion.RECHAZADA, true)))
                .isEqualTo(FaseDonacion.RECHAZADA);
        assertThat(FaseDonacion.de(donacion(ModalidadDonacion.FONDO_COMUN, EstadoDonacion.RECHAZADA, false)))
                .isEqualTo(FaseDonacion.RECHAZADA);
    }

    @Test
    void cancelada_esBannerTerminalCancelada_sinImportarModalidadNiNecesidad() {
        assertThat(FaseDonacion.de(donacion(ModalidadDonacion.DIRECTA, EstadoDonacion.CANCELADA, true)))
                .isEqualTo(FaseDonacion.CANCELADA);
        assertThat(FaseDonacion.de(donacion(ModalidadDonacion.FONDO_COMUN, EstadoDonacion.CANCELADA, false)))
                .isEqualTo(FaseDonacion.CANCELADA);
    }
}
