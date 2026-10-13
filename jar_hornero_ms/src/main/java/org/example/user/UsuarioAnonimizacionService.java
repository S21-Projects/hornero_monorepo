package org.example.user;

import lombok.RequiredArgsConstructor;
import org.example.actividad.ActividadService;
import org.example.actividad.TipoActividad;
import org.example.auth.RefreshTokenService;
import org.example.auth.otp.CodigoVerificacionRepository;
import org.example.auth.reset.PasswordResetTokenRepository;
import org.example.domain.OrganizacionRepository;
import org.example.idempotencia.IdempotenciaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

/**
 * N15/D12 (Ley 25.326 art. 16, policy 1.3): erasure by anonymization, run by an administrator.
 * The account row stays, so donations and the activity log keep their references and the
 * traceability of the system is intact, but nothing in it identifies the person any more.
 *
 * <p>Guard rails (all answer 409 with a stable code):
 * <ul>
 *   <li>{@code ANONIMIZAR_CUENTA_PROPIA}: an admin cannot anonymize their own account;</li>
 *   <li>{@code USUARIO_YA_ANONIMIZADO}: nothing left to erase;</li>
 *   <li>{@code ULTIMO_ADMINISTRADOR}: at least one active administrator must remain;</li>
 *   <li>{@code REFERENTE_CON_ORGANIZACIONES}: an organization would be left without a contact
 *       while donations may be in flight; the admin reassigns it first.</li>
 * </ul>
 *
 * <p>The placeholder email is random, not a hash of the original: a hash of an email can be
 * reversed by trying candidates. {@code .invalid} is reserved (RFC 2606), so mail to it can never
 * be delivered. The password is replaced by the BCrypt hash of a random secret that is discarded.
 */
@Service
@RequiredArgsConstructor
public class UsuarioAnonimizacionService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UsuarioRepository usuarioRepository;
    private final OrganizacionRepository organizacionRepository;
    private final RefreshTokenService refreshTokenService;
    private final ActividadService actividadService;
    private final PasswordEncoder passwordEncoder;
    private final CodigoVerificacionRepository codigoVerificacionRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final IdempotenciaRepository idempotenciaRepository;

    @Transactional
    public UsuarioResponse anonimizar(Long id, Long adminId) {
        if (id.equals(adminId)) {
            throw conflicto("ANONIMIZAR_CUENTA_PROPIA");
        }
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario not found"));
        if (u.esAnonimo()) {
            throw conflicto("USUARIO_YA_ANONIMIZADO");
        }
        if (u instanceof Administrador && u.isActivo() && usuarioRepository.countAdministradoresActivos() <= 1) {
            throw conflicto("ULTIMO_ADMINISTRADOR");
        }
        if (u instanceof Referente && !organizacionRepository.findByReferente_Id(id).isEmpty()) {
            throw conflicto("REFERENTE_CON_ORGANIZACIONES");
        }

        String emailOriginal = u.getEmail();
        u.anonimizar("eliminado-" + UUID.randomUUID() + "@" + Usuario.DOMINIO_ANONIMO,
                passwordEncoder.encode(secretoDescartable()));
        Usuario guardado = usuarioRepository.saveAndFlush(u);
        UsuarioResponse respuesta = UsuarioResponse.de(guardado);

        refreshTokenService.revokeAllFor(id);
        codigoVerificacionRepository.deleteByEmailIgnoreCase(emailOriginal);
        passwordResetTokenRepository.deleteByUsuarioId(id);
        idempotenciaRepository.deleteByUsuarioId(id);

        // Actor = the admin in the security context. No data of the subject goes in the entry.
        actividadService.registrar(ActividadService.Registro.de(TipoActividad.USUARIO_ANONIMIZADO)
                .entidad("USUARIO", id)
                .detalle("cuenta anonimizada"));
        return respuesta;
    }

    private static String secretoDescartable() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }

    private static ResponseStatusException conflicto(String codigo) {
        return new ResponseStatusException(HttpStatus.CONFLICT, codigo);
    }
}
