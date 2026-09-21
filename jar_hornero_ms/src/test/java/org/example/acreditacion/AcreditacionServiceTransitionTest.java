package org.example.acreditacion;

import org.example.domain.NivelAcreditacion;
import org.example.domain.OrganizacionEventoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * AD-2: the transition table mirrors {@code DonacionService.TRANSICIONES_PERMITIDAS}
 * (`DonacionService.java:36-46`). Every legal single-rung move succeeds; every illegal move,
 * including a skip, is rejected with {@code 400} and the exact precedent message shape.
 */
@ExtendWith(MockitoExtension.class)
class AcreditacionServiceTransitionTest {

    @Mock
    private OrganizacionEventoRepository eventoRepository;

    @InjectMocks
    private AcreditacionService acreditacionService;

    @ParameterizedTest
    @CsvSource({"N0,N1", "N1,N0", "N1,N2", "N2,N1", "N2,N3", "N3,N2"})
    void legalTransitionsSucceed(NivelAcreditacion actual, NivelAcreditacion siguiente) throws Exception {
        invokeValidateTransition(actual, siguiente);
        // no exception thrown == success
    }

    @ParameterizedTest
    @CsvSource({"N0,N2", "N0,N3", "N1,N3", "N2,N0", "N3,N0", "N3,N1"})
    void illegalTransitionsAreRejected(NivelAcreditacion actual, NivelAcreditacion siguiente) {
        assertThatThrownBy(() -> invokeValidateTransition(actual, siguiente))
                .cause()
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Invalid state transition: " + actual + " -> " + siguiente)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void n0SkippingDirectlyToN2IsRejected() {
        assertThatThrownBy(() -> invokeValidateTransition(NivelAcreditacion.N0, NivelAcreditacion.N2))
                .cause()
                .isInstanceOf(ResponseStatusException.class);
    }

    private void invokeValidateTransition(NivelAcreditacion actual, NivelAcreditacion siguiente) throws Exception {
        Method method = AcreditacionService.class.getDeclaredMethod(
                "validateTransition", NivelAcreditacion.class, NivelAcreditacion.class);
        method.setAccessible(true);
        method.invoke(acreditacionService, actual, siguiente);
    }
}
