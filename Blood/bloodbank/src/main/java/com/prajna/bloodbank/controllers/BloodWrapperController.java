package com.prajna.bloodbank.controllers;

import com.prajna.bloodbank.service.bloodService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
public class BloodWrapperController {

    private final bloodService service;

    public BloodWrapperController(bloodService service) {
        this.service = service;
    }

    @GetMapping("/api/bloodbanks")
    public List<Map<String, Object>> getBloodBank(
            @RequestParam String stateCode,
            @RequestParam String districtCode,
            @RequestParam String hospitalCode
    ) {
        // call your existing service
        Map<String, Object> data = service.fetchBlood(stateCode, districtCode, hospitalCode);

        // wrap in gov API style
        Map<String, Object> wrapped = new HashMap<>();
        wrapped.put("hospitalCode", hospitalCode);
        wrapped.put("hospitalName", data.get("hospital"));
        wrapped.put("hospitalType", "Govt."); // you can adjust later
        wrapped.put("hospitalAddress", "Address unknown"); // optionally fetch from /hospitals endpoint
        wrapped.put("bloodComponents", data.get("blood"));
        wrapped.put("lastUpdated", data.get("lastUpdated"));
        wrapped.put("offline", data.get("offline"));
        wrapped.put("status", data.get("status"));
        wrapped.put("message", data.get("message"));

        return List.of(wrapped);
    }
}
