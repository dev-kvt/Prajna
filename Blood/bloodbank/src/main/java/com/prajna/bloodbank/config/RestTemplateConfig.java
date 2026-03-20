package com.prajna.bloodbank.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
@EnableConfigurationProperties(ExternalApiProperties.class)
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate(ExternalApiProperties properties) {
        // Adjust timeouts via application.properties (external.api.*)
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.connectTimeout());
        factory.setReadTimeout(properties.readTimeout());
        return new RestTemplate(factory);
    }
}
