# Blood Bank Wrapper API

A lightweight Spring Boot service that wraps the eRaktKosh blood-availability API and normalizes the response for your frontend.

## Base URL

Local default:

```
http://localhost:8080
```

## Endpoint

`GET /api/bloodbanks`

### Query Parameters

- `stateCode` (required) — eRaktKosh state code
- `districtCode` (required) — eRaktKosh district code
- `hospitalCode` (required) — eRaktKosh hospital code

### Example Request

```bash
curl "http://localhost:8080/api/bloodbanks?stateCode=12&districtCode=268&hospitalCode=IN001"
```

### Example Response (Success)

```json
[
  {
    "hospitalCode": "IN001",
    "hospitalName": "Example Hospital",
    "hospitalType": "Govt.",
    "hospitalAddress": "Address unknown",
    "bloodComponents": {
      "A+": 5,
      "B+": 2
    },
    "lastUpdated": "2024-03-20 12:30:00",
    "offline": false
  }
]
```

### Example Response (Upstream Unavailable)

If the external API is slow/unreachable, the service returns quickly with empty data. You can detect this by checking `offline: true` and empty `bloodComponents`.

```json
[
  {
    "hospitalCode": "IN001",
    "hospitalName": null,
    "hospitalType": "Govt.",
    "hospitalAddress": "Address unknown",
    "bloodComponents": {},
    "lastUpdated": null,
    "offline": true
  }
]
```

## Configuration

Timeouts and caching are configured in `application.properties`:

```properties
# External API settings
external.api.base-url=https://eraktkosh.mohfw.gov.in/eraktkoshPortal/eraktkosh/blood-availability
external.api.connect-timeout=5s
external.api.read-timeout=5s

# Optional cache (Caffeine)
spring.cache.type=caffeine
spring.cache.cache-names=bloodAvailability
spring.cache.caffeine.spec=expireAfterWrite=60s,maximumSize=1000
```

## Notes

- The service uses `RestTemplate` with explicit connect/read timeouts to avoid hanging requests.
- Caching is enabled to reduce load on the upstream API.
- All responses are wrapped in a list to match the expected frontend format.
