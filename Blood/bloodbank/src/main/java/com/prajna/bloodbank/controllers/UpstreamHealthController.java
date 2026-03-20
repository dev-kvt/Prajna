package com.prajna.bloodbank.controllers;

import com.prajna.bloodbank.config.ExternalApiProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/health")
public class UpstreamHealthController {
    private final RestTemplate restTemplate;
    private final ExternalApiProperties apiProperties;

    public UpstreamHealthController(RestTemplate restTemplate, ExternalApiProperties apiProperties) {
        this.restTemplate = restTemplate;
        this.apiProperties = apiProperties;
    }

    @GetMapping("/upstream")
    public ResponseEntity<Map<String, Object>> upstream(
            @RequestParam String stateCode,
            @RequestParam String districtId,
            @RequestParam(defaultValue = "12") String componentId,
            @RequestParam String hospitalCodes
    ) {
        String url = UriComponentsBuilder
                .fromUriString(apiProperties.baseUrl())
                .queryParam("stateCode", stateCode)
                .queryParam("districtId", districtId)
                .queryParam("componentId", componentId)
                .queryParam("hospitalCodes", hospitalCodes)
                .toUriString();

        Instant start = Instant.now();
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            long durationMs = Duration.between(start, Instant.now()).toMillis();

            Map<String, Object> body = new HashMap<>();
            body.put("status", "ok");
            body.put("httpStatus", response.getStatusCode().value());
            body.put("durationMs", durationMs);
            body.put("contentLength", response.getBody() == null ? 0 : response.getBody().length());
            body.put("url", url);

            return ResponseEntity.ok(body);
        } catch (HttpStatusCodeException ex) {
            long durationMs = Duration.between(start, Instant.now()).toMillis();
            Map<String, Object> body = new HashMap<>();
            body.put("status", "error");
            body.put("httpStatus", ex.getStatusCode().value());
            body.put("durationMs", durationMs);
            body.put("message", ex.getMessage());
            body.put("url", url);
            return ResponseEntity.status(502).body(body);
        } catch (ResourceAccessException ex) {
            long durationMs = Duration.between(start, Instant.now()).toMillis();
            Map<String, Object> body = new HashMap<>();
            body.put("status", "timeout");
            body.put("durationMs", durationMs);
            body.put("message", ex.getMessage());
            body.put("url", url);
            return ResponseEntity.status(504).body(body);
        } catch (RestClientException ex) {
            long durationMs = Duration.between(start, Instant.now()).toMillis();
            Map<String, Object> body = new HashMap<>();
            body.put("status", "error");
            body.put("durationMs", durationMs);
            body.put("message", ex.getMessage());
            body.put("url", url);
            return ResponseEntity.status(502).body(body);
        }
    }
}
