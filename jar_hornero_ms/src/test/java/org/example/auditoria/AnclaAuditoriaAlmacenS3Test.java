package org.example.auditoria;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.lang.reflect.Method;
import java.time.LocalDate;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

class AnclaAuditoriaAlmacenS3Test {

    private final S3Client s3 = mock(S3Client.class);
    private final AnclaAuditoriaAlmacenS3 almacen = new AnclaAuditoriaAlmacenS3(s3, "hornero-images");

    @Test
    void writesOnlyUnderTheAnchorPrefixWithTheDateAsName() {
        when(s3.headObject(any(HeadObjectRequest.class))).thenThrow(NoSuchKeyException.builder().build());

        boolean subido = almacen.publicar(LocalDate.of(2026, 11, 8), "contenido");

        assertThat(subido).isTrue();
        ArgumentCaptor<PutObjectRequest> put = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3).putObject(put.capture(), any(RequestBody.class));
        assertThat(put.getValue().key()).isEqualTo("audit/anchors/2026-11-08.txt");
        assertThat(put.getValue().bucket()).isEqualTo("hornero-images");
    }

    @Test
    void neverOverwritesAnAnchorThatAlreadyExists() {
        when(s3.headObject(any(HeadObjectRequest.class))).thenReturn(HeadObjectResponse.builder().build());

        assertThat(almacen.publicar(LocalDate.of(2026, 11, 8), "otro contenido")).isFalse();

        verify(s3, never()).putObject(any(PutObjectRequest.class), any(RequestBody.class));
    }

    @Test
    void refusesEveryKeyOutsideTheAnchorPrefixBeforeAnyRequest() {
        for (String clave : new String[] {
                "images/banner.png", "org-evidencia/1/a.pdf", "reclamo-evidencia/x", "audit/anchors/../images/x.txt",
                "audit/anchors/2026-11-08.txt/extra", "audit/anchors/x.txt", "audit/other/2026-11-08.txt", "", null}) {
            assertThatThrownBy(() -> almacen.escribir(clave, "x")).isInstanceOf(IllegalArgumentException.class);
        }
        verifyNoMoreInteractions(s3);
    }

    @Test
    void hasNoWayToDeleteAnything() {
        assertThat(Arrays.stream(AnclaAuditoriaAlmacenS3.class.getDeclaredMethods()).map(Method::getName))
                .noneMatch(n -> n.toLowerCase().contains("delete") || n.toLowerCase().contains("borrar")
                        || n.toLowerCase().contains("remove"));
        assertThat(Arrays.stream(AnclaAuditoriaAlmacen.class.getDeclaredMethods()).map(Method::getName))
                .containsExactlyInAnyOrder("publicar", "disponible");
    }
}
