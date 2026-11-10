package org.example;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.time.Clock;
import java.time.ZoneId;

@SpringBootApplication
@EnableScheduling
public class MainApplication {

    public static void main(String[] args) {
        SpringApplication.run(MainApplication.class, args);
    }

    /**
     * System clock bean so time-dependent components (OTP TTL/throttle) can
     * be swapped for a fixed clock in tests. The zone is Argentina (the product's calendar), so
     * {@code LocalDate.now(clock)} is the local business day (necesidad expiry, rondas); instants
     * are unaffected by the zone.
     */
    @Bean
    public Clock clock() {
        return Clock.system(ZoneId.of("America/Argentina/Buenos_Aires"));
    }
}
