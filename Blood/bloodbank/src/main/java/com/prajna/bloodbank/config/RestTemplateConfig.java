package com.prajna.bloodbank.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Configuration
@EnableConfigurationProperties(ExternalApiProperties.class)
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate(ExternalApiProperties properties) {
        // Adjust timeouts via application.properties (external.api.*)
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.connectTimeout());
        factory.setReadTimeout(properties.readTimeout());
        RestTemplate restTemplate = new RestTemplate(factory);
        restTemplate.getInterceptors().add((request, body, execution) -> {
            HttpHeaders headers = request.getHeaders();
            if (headers.getFirst(HttpHeaders.USER_AGENT) == null) {
                headers.set(HttpHeaders.USER_AGENT, properties.userAgent());
            }
            if (headers.getAccept().isEmpty()) {
                headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            }
            return execution.execute(request, body);
        });
        return restTemplate;
    }
}
