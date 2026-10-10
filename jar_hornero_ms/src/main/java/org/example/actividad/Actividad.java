package org.example.actividad;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Converter;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

import java.time.Instant;

/**
 * One row of the append-only activity log ("Registro de actividades", N10/D10): when, where, who
 * and what (OWASP ASVS 5.0 16.2.1). Same discipline as {@code OrganizacionEvento}: getters only,
 * a package-private constructor and no setters; {@link ActividadRepository} offers insert and
 * finders only (16.4.2). The one deliberate exception is the retention purge, isolated in
 * {@link ActividadRetencionRepository}.
 *
 * <p>Never holds passwords, tokens or codes (16.2.5). {@code emailIntento} is the single piece of
 * personal data stored beyond ids, and only for failed logins: without it a credential-stuffing run
 * against one address cannot be told apart from noise. {@code ip} is the client address forwarded
 * by the BFF. Free text is sanitized by {@link ActividadService} before it gets here (16.4.1).
 */
@Entity
@Immutable
@Table(
        name = "actividad",
        indexes = {
                @Index(name = "idx_actividad_ocurrido", columnList = "ocurrido_en"),
                @Index(name = "idx_actividad_actor", columnList = "actor_usuario_id"),
                @Index(name = "idx_actividad_accion", columnList = "accion"),
                @Index(name = "idx_actividad_entidad", columnList = "entidad_tipo, entidad_id")
        })
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Actividad {

    static final int MAX_DETALLE = 500;
    static final int MAX_VALOR = 200;
    static final int MAX_MOTIVO = 500;
    static final int MAX_ENTIDAD_TIPO = 40;
    static final int MAX_IP = 45;
    static final int MAX_EMAIL = 254;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** UTC instant (ASVS 16.2.2). */
    @Column(name = "ocurrido_en", nullable = false, updatable = false)
    private Instant ocurridoEn;

    @Column(name = "actor_usuario_id", updatable = false)
    private Long actorUsuarioId;

    // accion and actor_tipo are stored as plain text through converters, not @Enumerated(STRING):
    // Hibernate would add a CHECK constraint listing today's values, and ddl-auto=update never
    // widens it, so every new TipoActividad would need a hand-written scripts/sql migration.
    @Convert(converter = ActorConverter.class)
    @Column(name = "actor_tipo", nullable = false, updatable = false, length = 20)
    private TipoActor actorTipo;

    @Convert(converter = AccionConverter.class)
    @Column(nullable = false, updatable = false, length = 50)
    private TipoActividad accion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 10)
    private ResultadoActividad resultado;

    @Column(name = "entidad_tipo", updatable = false, length = MAX_ENTIDAD_TIPO)
    private String entidadTipo;

    @Column(name = "entidad_id", updatable = false)
    private Long entidadId;

    @Column(updatable = false, length = MAX_DETALLE)
    private String detalle;

    @Column(updatable = false, length = MAX_VALOR)
    private String antes;

    @Column(updatable = false, length = MAX_VALOR)
    private String despues;

    @Column(updatable = false, length = MAX_MOTIVO)
    private String motivo;

    @Column(updatable = false, length = MAX_IP)
    private String ip;

    /** Only for failed logins; see the class comment. */
    @Column(name = "email_intento", updatable = false, length = MAX_EMAIL)
    private String emailIntento;

    Actividad(Instant ocurridoEn, Long actorUsuarioId, TipoActor actorTipo, TipoActividad accion,
              ResultadoActividad resultado, String entidadTipo, Long entidadId, String detalle,
              String antes, String despues, String motivo, String ip, String emailIntento) {
        this.ocurridoEn = ocurridoEn;
        this.actorUsuarioId = actorUsuarioId;
        this.actorTipo = actorTipo;
        this.accion = accion;
        this.resultado = resultado;
        this.entidadTipo = entidadTipo;
        this.entidadId = entidadId;
        this.detalle = detalle;
        this.antes = antes;
        this.despues = despues;
        this.motivo = motivo;
        this.ip = ip;
        this.emailIntento = emailIntento;
    }

    @Converter
    public static class AccionConverter implements AttributeConverter<TipoActividad, String> {
        @Override
        public String convertToDatabaseColumn(TipoActividad valor) {
            return valor == null ? null : valor.name();
        }

        @Override
        public TipoActividad convertToEntityAttribute(String texto) {
            return texto == null ? null : TipoActividad.valueOf(texto);
        }
    }

    @Converter
    public static class ActorConverter implements AttributeConverter<TipoActor, String> {
        @Override
        public String convertToDatabaseColumn(TipoActor valor) {
            return valor == null ? null : valor.name();
        }

        @Override
        public TipoActor convertToEntityAttribute(String texto) {
            return texto == null ? null : TipoActor.valueOf(texto);
        }
    }
}
