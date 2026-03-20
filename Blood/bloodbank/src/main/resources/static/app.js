const form = document.getElementById("queryForm");
const baseUrlInput = document.getElementById("baseUrl");
const useLocalBtn = document.getElementById("useLocal");
const sampleBtn = document.getElementById("sampleBtn");
const submitBtn = document.getElementById("submitBtn");

const statusText = document.getElementById("statusText");
const timingText = document.getElementById("timingText");
const messageText = document.getElementById("messageText");
const hospitalMeta = document.getElementById("hospitalMeta");
const offlineBadge = document.getElementById("offlineBadge");
const lastUpdated = document.getElementById("lastUpdated");
const hospitalType = document.getElementById("hospitalType");
const hospitalAddress = document.getElementById("hospitalAddress");
const bloodList = document.getElementById("bloodList");

const inputs = {
  state: document.getElementById("stateCode"),
  district: document.getElementById("districtCode"),
  hospital: document.getElementById("hospitalCode")
};

useLocalBtn.addEventListener("click", () => {
  baseUrlInput.value = window.location.origin;
});

sampleBtn.addEventListener("click", () => {
  inputs.state.value = "97";
  inputs.district.value = "93";
  inputs.hospital.value = "284128";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  setLoading(true);
  statusText.textContent = "Fetching...";
  timingText.textContent = "--";
  messageText.textContent = "--";

  const base = baseUrlInput.value.trim() || window.location.origin;
  const url = new URL("/api/bloodbanks", base);
  url.searchParams.set("stateCode", inputs.state.value.trim());
  url.searchParams.set("districtCode", inputs.district.value.trim());
  url.searchParams.set("hospitalCode", inputs.hospital.value.trim());

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  const start = performance.now();

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    const data = await response.json();
    const duration = Math.round(performance.now() - start);

    timingText.textContent = `${duration} ms`;

    renderResponse(data);
    statusText.textContent = response.ok ? "OK" : `HTTP ${response.status}`;
  } catch (error) {
    timingText.textContent = "timeout";
    statusText.textContent = "Request failed";
    messageText.textContent = error.name === "AbortError" ? "Timed out" : error.message;
    renderResponse([]);
  } finally {
    clearTimeout(timeoutId);
    setLoading(false);
  }
});

function renderResponse(payload) {
  const item = Array.isArray(payload) ? payload[0] : payload;

  if (!item) {
    hospitalMeta.textContent = "No data available";
    offlineBadge.style.display = "inline-flex";
    offlineBadge.textContent = "Offline";
    lastUpdated.textContent = "--";
    hospitalType.textContent = "--";
    hospitalAddress.textContent = "--";
    bloodList.innerHTML = "";
    return;
  }

  const isOffline = item.offline === true || item.offline === "1" || item.status === "unavailable";
  offlineBadge.style.display = isOffline ? "inline-flex" : "none";

  statusText.textContent = item.status || (isOffline ? "unavailable" : "ok");
  messageText.textContent = item.message || "--";

  hospitalMeta.textContent = `${item.hospitalName || "Unknown hospital"} (${item.hospitalCode || "--"})`;
  lastUpdated.textContent = item.lastUpdated || "--";
  hospitalType.textContent = item.hospitalType || "--";
  hospitalAddress.textContent = item.hospitalAddress || "--";

  const components = item.bloodComponents || {};
  const entries = Object.entries(components);
  bloodList.innerHTML = entries
    .map(([group, count]) => {
      return `<div class="blood-chip"><span>${group}</span><span>${count}</span></div>`;
    })
    .join("");
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Fetching..." : "Fetch availability";
}
