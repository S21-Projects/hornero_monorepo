package org.example.organizacion.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.common.validation.UrlSegura;

/**
 * Admin-only body for PATCH /{id}/info-publica. Writes the live columns
 * directly and does not go through the pending-approval snapshot.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ActualizarInfoPublicaRequest {

    private Boolean aceptaDonaciones;

    @UrlSegura
    @Size(max = 500)
    private String sitioWebUrl;

    @UrlSegura
    @Size(max = 500)
    private String donacionDirectaUrl;

    /** S3 object key, set by the BFF after an admin-moderated image upload — see UploadController. */
    @Size(max = 500)
    private String profileImageKey;

    @Size(max = 500)
    private String bannerKey;
}
