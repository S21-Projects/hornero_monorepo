package org.example.evidencia;

import org.example.reclamo.ClaveEvidenciaReclamo;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectsResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * S3-compatible adapter (Cloudflare R2 in production, MinIO locally). It lists and deletes only
 * under {@code reclamo-evidencia/}: a key outside that prefix is rejected before any request.
 * The class is closed with the application context, which closes the underlying client.
 */
public class EvidenciaAlmacenS3 implements EvidenciaAlmacen, AutoCloseable {

    /** DeleteObjects accepts at most 1000 keys per request. */
    static final int LOTE_MAXIMO = 1000;

    private final S3Client s3;
    private final String bucket;

    public EvidenciaAlmacenS3(S3Client s3, String bucket) {
        this.s3 = s3;
        this.bucket = bucket;
    }

    @Override
    public boolean disponible() {
        return true;
    }

    @Override
    public List<ObjetoAlmacenado> listar() {
        List<ObjetoAlmacenado> res = new ArrayList<>();
        s3.listObjectsV2Paginator(ListObjectsV2Request.builder()
                        .bucket(bucket).prefix(ClaveEvidenciaReclamo.PREFIJO).build())
                .contents()
                .forEach(o -> res.add(new ObjetoAlmacenado(o.key(), o.lastModified())));
        return res;
    }

    @Override
    public ResultadoBorrado borrar(Collection<String> keys) {
        if (keys.isEmpty()) {
            return ResultadoBorrado.VACIO;
        }
        for (String key : keys) {
            if (!key.startsWith(ClaveEvidenciaReclamo.PREFIJO)) {
                throw new IllegalArgumentException("key outside the claim evidence prefix");
            }
        }
        List<String> todas = List.copyOf(keys);
        int borrados = 0;
        int fallidos = 0;
        for (int i = 0; i < todas.size(); i += LOTE_MAXIMO) {
            List<String> lote = todas.subList(i, Math.min(todas.size(), i + LOTE_MAXIMO));
            DeleteObjectsResponse r = s3.deleteObjects(DeleteObjectsRequest.builder()
                    .bucket(bucket)
                    .delete(Delete.builder()
                            .objects(lote.stream().map(k -> ObjectIdentifier.builder().key(k).build()).toList())
                            .quiet(true)
                            .build())
                    .build());
            int errores = r.errors().size();
            fallidos += errores;
            borrados += lote.size() - errores;
        }
        return new ResultadoBorrado(borrados, fallidos);
    }

    @Override
    public void close() {
        s3.close();
    }
}
