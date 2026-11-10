package org.example.evidencia;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ArchivoAcreditacionAlmacenS3Test {

    private final S3Client s3 = mock(S3Client.class);
    private final ArchivoAcreditacionAlmacenS3 almacen = new ArchivoAcreditacionAlmacenS3(s3, "bucket-de-prueba");

    @Test
    void deletesAnAccreditationEvidenceKeyFromTheConfiguredBucket() {
        when(s3.deleteObject(any(DeleteObjectRequest.class))).thenReturn(DeleteObjectResponse.builder().build());

        assertThat(almacen.borrar("org-evidencia/12/3f2b9c1e-aaaa-bbbb-cccc-0123456789ab.pdf")).isTrue();

        ArgumentCaptor<DeleteObjectRequest> captor = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3).deleteObject(captor.capture());
        assertThat(captor.getValue().bucket()).isEqualTo("bucket-de-prueba");
        assertThat(captor.getValue().key()).isEqualTo("org-evidencia/12/3f2b9c1e-aaaa-bbbb-cccc-0123456789ab.pdf");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "reclamo-evidencia/1/7/a.jpg",
            "org-banner/1/a.png",
            "org-profile/1/a.png",
            "audit/anchors/2026-11-08.txt",
            "org-evidencia/",
            "org-evidencia/1",
            "org-evidencia/abc/a.jpg",
            "org-evidencia/1/../org-banner/1/a.png",
            "org-evidencia/1/..",
            "org-evidencia/1/sub/a.jpg",
            "ORG-EVIDENCIA/1/a.jpg",
            "/org-evidencia/1/a.jpg",
            "x/org-evidencia/1/a.jpg",
            ""})
    void refusesAnyKeyOutsideTheAccreditationPrefixBeforeCallingTheStore(String key) {
        assertThatThrownBy(() -> almacen.borrar(key)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(s3);
    }

    @Test
    void refusesNull() {
        assertThatThrownBy(() -> almacen.borrar(null)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(s3);
    }
}
