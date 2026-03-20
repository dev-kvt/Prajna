package com.prajna.bloodbank.service;

import com.prajna.bloodbank.config.ExternalApiProperties;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class bloodService {
    private final RestTemplate restTemplate;
    private final ExternalApiProperties apiProperties;

    public bloodService(RestTemplate restTemplate, ExternalApiProperties apiProperties) {
        this.restTemplate = restTemplate;
        this.apiProperties = apiProperties;
    }

    @Cacheable(
            cacheNames = "bloodAvailability",
            key = "#state + ':' + #district + ':' + #hospital",
            unless = "#result == null || #result.isEmpty() || 'unavailable'.equals(#result.get('status'))"
    )
    public Map<String, Object> fetchBlood(String state, String district, String hospital) {
        String url = UriComponentsBuilder
                .fromUriString(apiProperties.baseUrl())
                .queryParam("stateCode", state)
                .queryParam("districtId", district)
                .queryParam("componentId", "12")
                .queryParam("hospitalCodes", hospital)
                .toUriString();

        try {
            List<Map<String, Object>> response = restTemplate.getForObject(url, List.class);
            if (response == null || response.isEmpty()) {
                return fallback("Empty response from external API", state, district, hospital);
            }

            Map<String, Object> raw = response.get(0);
            Map<String, Object> result = new HashMap<>();
            result.put("status", "ok");
            result.put("hospital", raw.get("hospitalname"));
            result.put("lastUpdated", raw.get("entrydate"));
            result.put("offline", raw.get("offline"));

            // Extract components
            Map<String, Object> components = (Map<String, Object>) raw.get("components");

            if (components != null && components.containsKey("Packed Red Blood Cells")) {
                Map<String, Object> rbc = (Map<String, Object>) components.get("Packed Red Blood Cells");

                String availableData = (String) rbc.get("available_WithQty");  // Use real stock
                result.put("blood", parse(availableData));
            } else {
                result.put("blood", Map.of());
            }

            return result;
        } catch (ResourceAccessException ex) {
            // Typically thrown on connect/read timeouts or DNS/connectivity issues
            return fallback("External API timed out or is unreachable", state, district, hospital);
        } catch (RestClientException ex) {
            return fallback("External API error", state, district, hospital);
        }
    }

    private Map<String, Object> fallback(String reason, String state, String district, String hospital) {
        Map<String, Object> result = new HashMap<>();
        result.put("status", "unavailable");
        result.put("message", reason);
        result.put("hospital", null);
        result.put("lastUpdated", null);
        result.put("offline", true);
        result.put("blood", Map.of());
        result.put("stateCode", state);
        result.put("districtCode", district);
        result.put("hospitalCode", hospital);
        result.put("timestamp", Instant.now().toString());
        return result;
    }

    private Map<String, Integer> parse(String data) {
        Map<String, Integer> map = new HashMap<>();
        if (data == null || data.isEmpty()) return map;

        String[] pairs = data.split(",");
        for (String p : pairs) {
            String[] parts = p.split(":");
            if (parts.length == 2) {
                try {
                    map.put(parts[0].trim(), Integer.parseInt(parts[1].trim()));
                } catch (NumberFormatException e) {
                    map.put(parts[0].trim(), 0); // fallback if parsing fails
                }
            }
        }
        return map;
    }
}
