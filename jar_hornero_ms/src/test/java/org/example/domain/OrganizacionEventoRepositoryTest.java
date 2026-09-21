package org.example.domain;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Reflection test over the declared interface methods of {@link OrganizacionEventoRepository}
 * (AD-3): append-only is enforced by the absence of an update/delete operation, which this test
 * makes checkable by machine rather than by reading one file on faith.
 */
class OrganizacionEventoRepositoryTest {

    @Test
    void exposesNoDeleteUpdateOrSaveAndFlushMethod() {
        Method[] declaredMethods = OrganizacionEventoRepository.class.getDeclaredMethods();

        boolean hasForbiddenMethod = Arrays.stream(declaredMethods)
                .anyMatch(method -> {
                    String name = method.getName();
                    return name.startsWith("delete")
                            || name.startsWith("update")
                            || name.equals("saveAndFlush")
                            || name.startsWith("deleteBy");
                });

        assertThat(hasForbiddenMethod).isFalse();
    }

    @Test
    void declaresOnlySaveAndTheTwoFinders() {
        Method[] declaredMethods = OrganizacionEventoRepository.class.getDeclaredMethods();

        assertThat(declaredMethods)
                .extracting(Method::getName)
                .containsExactlyInAnyOrder(
                        "save",
                        "findByOrganizacion_IdOrderByOcurridoEnAscIdAsc",
                        "findByOrganizacion_IdAndTipoIn");
    }
}
