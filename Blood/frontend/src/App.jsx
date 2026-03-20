import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const BASE_URL = 'https://bloodbank-proxy.dvnsh-work.workers.dev/'
const GEO_BASE = 'https://nominatim.openstreetmap.org/search'
const GEOCODE_DELAY_MS = 1100
const MAX_GEOCODE = 20

const SAMPLE_QUERY = {
  stateCode: '97',
  districtId: '93',
  hospitalCodes: '284128',
  componentId: '12',
}

const splitAvailability = (value) => {
  if (!value || typeof value !== 'string') return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const buildAddress = (center) => {
  return [center?.hospitalname, center?.hospitaladd].filter(Boolean).join(', ')
}

const getCenterKey = (center, index) => {
  return center?.hospitalCode || `${center?.hospitalname || 'hospital'}-${index}`
}

const toRad = (value) => (value * Math.PI) / 180

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const radius = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return radius * c
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const geocodeAddress = async (address) => {
  const params = new URLSearchParams({
    format: 'json',
    q: address,
    limit: '1',
  })

  const response = await fetch(`${GEO_BASE}?${params.toString()}`, {
    headers: { 'Accept-Language': 'en' },
  })

  if (!response.ok) {
    throw new Error(`Geocoding failed with status ${response.status}`)
  }

  const data = await response.json()
  if (!Array.isArray(data) || data.length === 0) return null

  const match = data[0]
  const lat = Number.parseFloat(match?.lat)
  const lon = Number.parseFloat(match?.lon)
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null

  return { lat, lon }
}

function App() {
  const [form, setForm] = useState(SAMPLE_QUERY)
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [lastQuery, setLastQuery] = useState(null)
  const [location, setLocation] = useState(null)
  const [locationStatus, setLocationStatus] = useState('idle')
  const [locationError, setLocationError] = useState('')
  const [distanceMap, setDistanceMap] = useState({})
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 })

  const geocodeCacheRef = useRef(new Map())
  const geocodeAttemptRef = useRef(new Set())
  const geocodeRunId = useRef(0)

  const previewUrl = useMemo(() => {
    const params = new URLSearchParams({
      stateCode: form.stateCode?.trim() || '',
      districtId: form.districtId?.trim() || '',
      hospitalCodes: form.hospitalCodes?.trim() || '',
      componentId: form.componentId?.trim() || '12',
    })

    const requiredReady =
      params.get('stateCode') &&
      params.get('districtId') &&
      params.get('hospitalCodes')

    if (!requiredReady) return null
    return `${BASE_URL}?${params.toString()}`
  }, [form])

  const updateField = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const fillSample = () => {
    setForm(SAMPLE_QUERY)
  }

  const clearForm = () => {
    setForm({ stateCode: '', districtId: '', hospitalCodes: '', componentId: '12' })
    setResults([])
    setError('')
    setLastQuery(null)
  }

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('error')
      setLocationError('Geolocation is not supported in this browser.')
      return
    }

    setLocationStatus('locating')
    setLocationError('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
        setLocationStatus('ready')
        setDistanceMap({})
        geocodeAttemptRef.current = new Set()
      },
      (positionError) => {
        setLocationStatus('error')
        setLocationError(
          positionError?.message || 'Unable to retrieve your location.'
        )
      },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const stateCode = form.stateCode?.trim()
    const districtId = form.districtId?.trim()
    const hospitalCodes = form.hospitalCodes?.trim()
    const componentId = form.componentId?.trim() || '12'

    if (!stateCode || !districtId || !hospitalCodes) {
      setError('Please fill state code, district ID, and hospital codes to continue.')
      return
    }

    const params = new URLSearchParams({
      stateCode,
      districtId,
      hospitalCodes,
      componentId,
    })

    const url = `${BASE_URL}?${params.toString()}`

    geocodeAttemptRef.current = new Set()
    setDistanceMap({})
    setIsLoading(true)
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const data = await response.json()
      if (!Array.isArray(data)) {
        throw new Error('Unexpected response format. Expected an array.')
      }

      setResults(data)
      setLastQuery({ stateCode, districtId, hospitalCodes, componentId })
    } catch (fetchError) {
      setResults([])
      setLastQuery(null)
      setError(fetchError?.message || 'Something went wrong while fetching data.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!location || results.length === 0 || isGeocoding) return

    const limitedResults = results.slice(0, MAX_GEOCODE)
    const targets = limitedResults
      .map((center, index) => ({ center, index }))
      .filter(({ center, index }) => {
        const key = getCenterKey(center, index)
        return !geocodeAttemptRef.current.has(key)
      })

    if (targets.length === 0) return

    const runId = ++geocodeRunId.current
    const total = targets.length

    setIsGeocoding(true)
    setGeocodeProgress({ done: 0, total })

    const run = async () => {
      let completed = 0
      const nextDistances = {}

      for (const item of targets) {
        if (geocodeRunId.current !== runId) return

        const { center, index } = item
        const key = getCenterKey(center, index)
        const address = buildAddress(center)

        let coords = null
        if (address) {
          coords = geocodeCacheRef.current.get(address)
          if (!coords) {
            try {
              coords = await geocodeAddress(address)
              if (coords) geocodeCacheRef.current.set(address, coords)
            } catch (geoError) {
              coords = null
            }
            await sleep(GEOCODE_DELAY_MS)
          }
        }

        if (coords) {
          const km = haversineKm(location.lat, location.lon, coords.lat, coords.lon)
          nextDistances[key] = { km, lat: coords.lat, lon: coords.lon }
        }

        geocodeAttemptRef.current.add(key)
        completed += 1
        setGeocodeProgress({ done: completed, total })
      }

      if (geocodeRunId.current !== runId) return
      setDistanceMap((prev) => ({ ...prev, ...nextDistances }))
      setIsGeocoding(false)
    }

    run()
  }, [distanceMap, isGeocoding, location, results])

  const sortedResults = useMemo(() => {
    if (results.length === 0) return []
    const mapped = results.map((center, index) => {
      const key = getCenterKey(center, index)
      return {
        center,
        index,
        key,
        distance: distanceMap[key],
      }
    })

    if (!location) return mapped

    return mapped.slice().sort((a, b) => {
      const distanceA = a.distance?.km
      const distanceB = b.distance?.km

      if (distanceA == null && distanceB == null) return a.index - b.index
      if (distanceA == null) return 1
      if (distanceB == null) return -1
      return distanceA - distanceB
    })
  }, [distanceMap, location, results])

  const nearest = useMemo(() => {
    if (!location) return null
    return sortedResults.find((item) => item.distance?.km != null) || null
  }, [location, sortedResults])

  return (
    <main className="app">
      <header className="hero">
        <div className="hero-text">
          <span className="pill">Blood Availability Worker API</span>
          <h1>Blood Availability Finder</h1>
          <p>
            Search live blood availability by hospital code using the eRaktKosh
            proxy. Fast, CORS-friendly, and safe to call directly from the
            frontend.
          </p>
          <div className="hero-meta">
            <div>
              <span className="meta-label">Base URL</span>
              <span className="meta-value">{BASE_URL}</span>
            </div>
            <div>
              <span className="meta-label">Cache Note</span>
              <span className="meta-value">
                First lookup may be slower; repeat queries are cached.
              </span>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <h2>Quick Checklist</h2>
          <ul>
            <li>Required: `stateCode`, `districtId`, `hospitalCodes`.</li>
            <li>`componentId` defaults to `12` (Packed Red Blood Cells).</li>
            <li>Use comma-separated hospital codes for multi-hospital search.</li>
          </ul>
          <button className="secondary" type="button" onClick={fillSample}>
            Reset to sample values
          </button>
        </div>
      </header>

      <section className="grid">
        <div className="panel">
          <div className="panel-header">
            <h3>Build Your Query</h3>
            <span className="panel-subtitle">
              All fields are strings. Leading zeros are allowed.
            </span>
          </div>

          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              State Code *
              <input
                className="input"
                value={form.stateCode}
                onChange={updateField('stateCode')}
                placeholder="97"
                inputMode="numeric"
                required
              />
            </label>
            <label className="field">
              District ID *
              <input
                className="input"
                value={form.districtId}
                onChange={updateField('districtId')}
                placeholder="93"
                inputMode="numeric"
                required
              />
            </label>
            <label className="field">
              Hospital Codes *
              <input
                className="input"
                value={form.hospitalCodes}
                onChange={updateField('hospitalCodes')}
                placeholder="284128"
                required
              />
              <span className="hint">Example: `284128` or `284128,284129`.</span>
            </label>
            <label className="field">
              Component ID
              <input
                className="input"
                value={form.componentId}
                onChange={updateField('componentId')}
                placeholder="12"
                inputMode="numeric"
              />
              <span className="hint">
                Leave blank to use `12` (Packed Red Blood Cells).
              </span>
            </label>

            {error ? <div className="error">{error}</div> : null}

            <div className="actions">
              <button className="primary" type="submit" disabled={isLoading}>
                {isLoading ? 'Fetching availability...' : 'Fetch availability'}
              </button>
              <button className="ghost" type="button" onClick={clearForm}>
                Clear
              </button>
            </div>

            {previewUrl ? (
              <div className="preview">
                <span className="meta-label">Request Preview</span>
                <code>{previewUrl}</code>
              </div>
            ) : (
              <div className="preview muted">
                <span className="meta-label">Request Preview</span>
                <span>Fill the required fields to generate the URL.</span>
              </div>
            )}
          </form>

          <div className="location">
            <div className="location-header">
              <h4>Your location</h4>
              <button
                className="secondary"
                type="button"
                onClick={requestLocation}
                disabled={locationStatus === 'locating'}
              >
                {locationStatus === 'locating' ? 'Locating...' : 'Use my location'}
              </button>
            </div>
            {location ? (
              <div className="location-meta">
                <div>
                  Latitude {location.lat.toFixed(4)}, Longitude{' '}
                  {location.lon.toFixed(4)}
                </div>
                <div>Accuracy: {Math.round(location.accuracy)} meters</div>
              </div>
            ) : (
              <p className="location-meta">
                Share your location to compute the nearest blood bank.
              </p>
            )}
            {locationError ? <div className="error">{locationError}</div> : null}
          </div>
        </div>

        <div className="panel results-panel">
          <div className="panel-header">
            <h3>Results</h3>
            {lastQuery ? (
              <span className="panel-subtitle">
                Showing availability for hospital codes {lastQuery.hospitalCodes}
              </span>
            ) : (
              <span className="panel-subtitle">
                Run a query to see live availability.
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="loading">
              <div className="loading-bar"></div>
              <p>Contacting the Worker and fetching live availability...</p>
            </div>
          ) : null}

          {!isLoading && results.length === 0 ? (
            <div className="empty-state">
              <h4>No results yet</h4>
              <p>
                Use the form to query a hospital. Results will appear here with
                component-level availability.
              </p>
            </div>
          ) : null}

          {!isLoading && results.length > 0 ? (
            <div className="results">
              <div className="results-summary">
                <span>{results.length} hospitals found</span>
                <span>Component ID: {lastQuery?.componentId || '12'}</span>
                {location && nearest ? (
                  <span>
                    Nearest: {nearest.center?.hospitalname || 'Unknown'} ({nearest.distance?.km?.toFixed(1)} km)
                  </span>
                ) : null}
              </div>

              {location && isGeocoding ? (
                <div className="geocode-status">
                  <div className="loading-bar small"></div>
                  <span>
                    Geocoding addresses {geocodeProgress.done}/
                    {geocodeProgress.total}
                  </span>
                </div>
              ) : null}

              {location && results.length > MAX_GEOCODE ? (
                <div className="limit-note">
                  Distance checks use the first {MAX_GEOCODE} results to respect
                  free geocoding limits. Narrow hospital codes to refine.
                </div>
              ) : null}

              {sortedResults.map(({ center, index, distance }) => {
                const components = center?.components || {}
                const componentEntries = Object.entries(components)

                return (
                  <article
                    key={getCenterKey(center, index)}
                    className="result-card"
                  >
                    <div className="result-header">
                      <div>
                        <h4>{center.hospitalname || 'Unknown hospital'}</h4>
                        <p className="result-meta">
                          {center.hospitalType || 'Hospital'} - Code{' '}
                          {center.hospitalCode || 'N/A'}
                        </p>
                      </div>
                      <span
                        className={`tag ${center.offline === '1' ? 'warn' : 'live'}`}
                      >
                        {center.offline === '1' ? 'Offline snapshot' : 'Live data'}
                      </span>
                    </div>

                    {location ? (
                      <p
                        className={`result-distance ${
                          distance?.km != null ? '' : 'muted'
                        }`}
                      >
                        {distance?.km != null
                          ? `${distance.km.toFixed(1)} km away`
                          : isGeocoding
                            ? 'Calculating distance...'
                            : 'Distance unavailable'}
                      </p>
                    ) : null}

                    <p className="result-address">{center.hospitaladd}</p>
                    {center.hospitalcontact ? (
                      <p className="result-contact">{center.hospitalcontact}</p>
                    ) : null}
                    {center.entrydate ? (
                      <p className="result-updated">
                        Last updated: {center.entrydate}
                      </p>
                    ) : null}

                    <div className="component-grid">
                      {componentEntries.length === 0 ? (
                        <div className="component-empty">
                          No component availability data returned.
                        </div>
                      ) : (
                        componentEntries.map(([componentName, details]) => {
                          const groups = splitAvailability(
                            details?.available_WithQty
                          )

                          return (
                            <div className="component" key={componentName}>
                              <div className="component-title">
                                {componentName}
                              </div>
                              {groups.length === 0 ? (
                                <p className="component-empty">
                                  No blood group quantities listed.
                                </p>
                              ) : (
                                <div className="chips">
                                  {groups.map((group) => (
                                    <span className="chip" key={group}>
                                      {group}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default App
