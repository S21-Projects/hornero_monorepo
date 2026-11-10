package org.example.config;

import org.example.domain.NivelAcreditacion;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * `specs/organizacion-acreditacion/spec.md` "Level-Driven Concurrency Caps": cap values are
 * configuration, not hardcoded, per the `app.otp.*` precedent (`OtpService.java:38-41`).
 */
@Component
public class AcreditacionProperties {

    private final long capN0;
    private final long capN1;
    private final long capN2;
    private final long capN3;

    public AcreditacionProperties(
            @Value("${app.acreditacion.cap-n0:0}") long capN0,
            @Value("${app.acreditacion.cap-n1:3}") long capN1,
            @Value("${app.acreditacion.cap-n2:6}") long capN2,
            @Value("${app.acreditacion.cap-n3:12}") long capN3) {
        this.capN0 = capN0;
        this.capN1 = capN1;
        this.capN2 = capN2;
        this.capN3 = capN3;
    }

    /** The maximum number of concurrently open `necesidad` records for the given level. */
    public long capPara(NivelAcreditacion nivel) {
        return switch (nivel) {
            case N0 -> capN0;
            case N1 -> capN1;
            case N2 -> capN2;
            case N3 -> capN3;
        };
    }
}
