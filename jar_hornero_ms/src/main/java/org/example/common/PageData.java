package org.example.common;

import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Stable page DTO that replaces Spring's {@code PageImpl} in HTTP responses.
 * Spring's PageImpl JSON contract is unstable across versions; this record owns the contract.
 *
 * <p>Use {@link #from(Page)} to convert any Spring {@code Page} result.
 */
public record PageData<T>(
        List<T> content,
        int number,
        int size,
        long totalElements,
        int totalPages
) {

    public static <T> PageData<T> from(Page<T> page) {
        return new PageData<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }
}
