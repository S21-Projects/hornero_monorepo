package org.example.common.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.net.URI;
import java.net.URISyntaxException;

public class UrlSeguraValidator implements ConstraintValidator<UrlSegura, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) {
            return true; // field omitted -> unchanged
        }
        if (value.isEmpty()) {
            return true; // explicit clear sentinel
        }
        if (value.isBlank()) {
            return false; // whitespace-only rejected
        }

        String trimmed = value.trim();
        if (trimmed.length() > 500) {
            return false;
        }

        try {
            URI uri = new URI(trimmed);
            if (!uri.isAbsolute()) {
                return false;
            }
            String scheme = uri.getScheme();
            if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
                return false;
            }
            String host = uri.getHost();
            return host != null && !host.isBlank();
        } catch (URISyntaxException e) {
            return false;
        }
    }
}
