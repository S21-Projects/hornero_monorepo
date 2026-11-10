package org.example.auditoria;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.time.LocalDate;
import java.util.regex.Pattern;

/**
 * S3-compatible adapter that writes anchors and nothing else. It only ever touches keys of the form
 * {@code audit/anchors/YYYY-MM-DD.txt} (the allow-list below, checked before any request), it
 * issues only {@code HeadObject} and {@code PutObject}, and it has no delete. An anchor that
 * already exists is never overwritten: the first one published for a day stands.
 */
public class AnclaAuditoriaAlmacenS3 implements AnclaAuditoriaAlmacen, AutoCloseable {

    static final String PREFIJO = "audit/anchors/";
    static final Pattern CLAVE_PERMITIDA = Pattern.compile("^audit/anchors/\\d{4}-\\d{2}-\\d{2}\\.txt$");

    private final S3Client s3;
    private final String bucket;

    public AnclaAuditoriaAlmacenS3(S3Client s3, String bucket) {
        this.s3 = s3;
        this.bucket = bucket;
    }

    @Override
    public boolean disponible() {
        return true;
    }

    @Override
    public boolean publicar(LocalDate fecha, String contenido) {
        String clave = PREFIJO + fecha + ".txt";
        if (existe(clave)) {
            return false;
        }
        escribir(clave, contenido);
        return true;
    }

    /** Package-private so the allow-list can be tested directly; {@link #publicar} is the only caller. */
    void escribir(String clave, String contenido) {
        if (clave == null || !CLAVE_PERMITIDA.matcher(clave).matches()) {
            throw new IllegalArgumentException("key is not an audit anchor key");
        }
        s3.putObject(PutObjectRequest.builder().bucket(bucket).key(clave).contentType("text/plain; charset=utf-8").build(),
                RequestBody.fromString(contenido));
    }

    private boolean existe(String clave) {
        if (!CLAVE_PERMITIDA.matcher(clave).matches()) {
            throw new IllegalArgumentException("key is not an audit anchor key");
        }
        try {
            s3.headObject(HeadObjectRequest.builder().bucket(bucket).key(clave).build());
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                return false;
            }
            throw e;
        }
    }

    @Override
    public void close() {
        s3.close();
    }
}
