package org.example.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Validates that a String is either null (field omitted, unchanged), an
 * empty string (explicit clear sentinel), or an absolute http/https URL
 * with a non-blank host. Whitespace-only values are rejected.
 */
@Documented
@Constraint(validatedBy = UrlSeguraValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface UrlSegura {

    String message() default "URL inválida";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
