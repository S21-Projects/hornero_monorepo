package org.example.mail;

import lombok.extern.slf4j.Slf4j;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Thin wrapper over the Resend HTTP API using {@link RestClient} (ships with
 * spring-boot-starter-web already in this project — no new dependency, unlike
 * WebClient which would drag in reactor/netty for a single blocking POST).
 */
@Slf4j
public class ResendClient {

    private static final String RESEND_URL = "https://api.resend.com/emails";

    private final RestClient restClient;
    private final String apiKey;

    public ResendClient(String apiKey) {
        this.apiKey = apiKey;
        this.restClient = RestClient.create();
    }

    public void send(String from, String to, String subject, String html, String text) {
        restClient.post()
                .uri(RESEND_URL)
                .header("Authorization", "Bearer " + apiKey)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "from", from,
                        "to", List.of(to),
                        "subject", subject,
                        "html", html,
                        "text", text
                ))
                .retrieve()
                .toBodilessEntity();
    }
}
