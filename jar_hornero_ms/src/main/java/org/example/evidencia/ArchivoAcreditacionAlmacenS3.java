package org.example.evidencia;

import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

import java.util.regex.Pattern;

/**
 * S3-compatible adapter that deletes accreditation evidence only. The explicit allow-list is the
 * pattern below: {@code org-evidencia/{orgId}/{file}} with a plain file name (no slash, no leading
 * dot, so no {@code ..}). Anything else is refused before a request is made, so a bug or a bad row
 * in the caller can never delete a banner, a profile image, a claim file or a backup.
 */
public class ArchivoAcreditacionAlmacenS3 implements ArchivoAcreditacionAlmacen, AutoCloseable {

    static final Pattern CLAVE_PERMITIDA = Pattern.compile("^org-evidencia/\\d+/[A-Za-z0-9][A-Za-z0-9._-]*$");

    private final S3Client s3;
    private final String bucket;

    public ArchivoAcreditacionAlmacenS3(S3Client s3, String bucket) {
        this.s3 = s3;
        this.bucket = bucket;
    }

    @Override
    public boolean disponible() {
        return true;
    }

    @Override
    public boolean borrar(String key) {
        if (key == null || !CLAVE_PERMITIDA.matcher(key).matches()) {
            throw new IllegalArgumentException("key is not an accreditation evidence key");
        }
        s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        return true;
    }

    @Override
    public void close() {
        s3.close();
    }
}
