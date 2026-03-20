package com.prajna.bloodbank.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "external.api")
public record ExternalApiProperties(
        String baseUrl,
        Duration connectTimeout,
        Duration readTimeout
) {}
