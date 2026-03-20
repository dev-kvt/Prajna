package com.prajna.bloodbank.service;

import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
@Service
public class bloodService {
    public final RestTemplate restTemplate = new RestTemplate();

    public Map<String, Object> fetchBlood(String state, String district, String hospital) {
        String url = "https://eraktkosh.mohfw.gov.in/eraktkoshPortal/eraktkosh/blood-availability"
                + "?stateCode=" + state
                + "&districtId=" + district
                + "&componentId=12"
                + "&hospitalCodes=" + hospital;

        List<Map<String, Object>> response = restTemplate.getForObject(url, List.class);
        if (response == null || response.isEmpty()) return Map.of();

        Map<String, Object> raw = response.get(0);
        Map<String, Object> result = new HashMap<>();
        result.put("hospital", raw.get("hospitalname"));
        result.put("lastUpdated", raw.get("entrydate"));
        result.put("offline", raw.get("offline"));

        // Extract components
        Map<String, Object> components = (Map<String, Object>) raw.get("components");

        if (components != null && components.containsKey("Packed Red Blood Cells")) {
            Map<String, Object> rbc = (Map<String, Object>) components.get("Packed Red Blood Cells");

            String availableData = (String) rbc.get("available_WithQty");  // Use real stock
            result.put("blood", parse(availableData));
        }

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