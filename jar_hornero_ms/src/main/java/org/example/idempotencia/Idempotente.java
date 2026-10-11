package org.example.idempotencia;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a business {@code POST} handler as requiring an {@code Idempotency-Key} header
 * (draft-ietf-httpapi-idempotency-key-header-07). {@link IdempotenciaFilter} enforces it:
 * a missing or malformed key is a 400, a repeated key replays the stored response, a key still in
 * flight is a 409 and a key reused with another payload is a 422.
 *
 * <p>Not for {@code /api/auth/**}: those endpoints have their own replay semantics (unique email,
 * token rotation, throttles). PUT/PATCH/DELETE are covered by the state machines and by
 * {@code @Version} optimistic locking instead.
 */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Idempotente {
}
