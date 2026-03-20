package com.prajna.bloodbank.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "external.api")
public record ExternalApiProperties(
        String baseUrl,
        Duration connectTimeout,
        Duration readTimeout,
        Retry retry,
        String userAgent
) {
    public ExternalApiProperties {
        if (connectTimeout == null) {
            connectTimeout = Duration.ofSeconds(5);
        }
        if (readTimeout == null) {
            readTimeout = Duration.ofSeconds(5);
        }
        if (retry == null) {
            retry = new Retry(2, Duration.ofMillis(300));
        }
        if (userAgent == null || userAgent.isBlank()) {
            userAgent = "bloodbank-wrapper/1.0";
        }
    }

    public record Retry(int maxAttempts, Duration backoff) {
        public Retry {
            if (maxAttempts <= 0) {
                maxAttempts = 1;
            }
            if (backoff == null) {
                backoff = Duration.ofMillis(300);
            }
        }
    }
}
