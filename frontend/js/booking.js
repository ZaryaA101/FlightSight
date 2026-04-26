// booking.js

const API_BASE = "http://localhost:3000";

async function getJSON(path) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  console.log("[FlightSight] Request URL:", url);

  try {
    const r = await fetch(url);
    if (!r.ok) {
      console.error("[FlightSight] API response error:", {
        url,
        status: r.status,
        statusText: r.statusText,
      });
      throw new Error(`${url} failed: ${r.status} ${r.statusText}`);
    }
    return r.json();
  } catch (err) {
    console.error("[FlightSight] API fetch failed:", { url, error: err });
    throw err;
  }
}

function getSelectedFlight() {
  const raw = localStorage.getItem("selectedFlight");
  if (!raw) return null;

  try {
    const flight = JSON.parse(raw);
    const requiredKeys = [
      "legId",
      "origin",
      "destination",
      "departureDate",
      "airline",
      "totalFare",
      "travelDuration",
      "flightTime",
      "layoverTime",
      "stops",
      "seatAvailability",
      "confidence",
      "departureTime",
      "arrivalTime",
      "isPredicted",
    ];

    const hasAllKeys = requiredKeys.every((key) => key in flight);
    return hasAllKeys ? flight : null;
  } catch {
    return null;
  }
}

/**
 * Read selected flight from localStorage (set in flightResults.js):
 */
function getStoredFlight() {
  const flightRaw = localStorage.getItem("selectedFlight");
  if (!flightRaw) return null;

  try {
    return JSON.parse(flightRaw);
  } catch {
    return null;
  }
}

/**
 * Read dates from localStorage (set in calendar.js):
 */
function getStoredDates() {
  const depart = localStorage.getItem("departureDate");
  const ret = localStorage.getItem("returnDate");
  return { departure: depart, return: ret };
}

function getStoredRoute() {
  try {
    const originRaw = localStorage.getItem("origin");
    const destinationRaw = localStorage.getItem("destination");
    if (!originRaw || !destinationRaw) return null;

    const origin = JSON.parse(originRaw);
    const destination = JSON.parse(destinationRaw);
    return { origin, destination };
  } catch {
    return null;
  }
}

function extractAirportCode(value) {
  if (!value) return "";
  if (typeof value === "object") {
    const nested = value.code || value.airport || value.iata || value.airportCode;
    return extractAirportCode(nested);
  }

  const s = String(value).trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(s)) return s;

  const m = s.match(/\b([A-Z]{3})\b/);
  return m ? m[1] : "";
}

function normalizeDateForWeather(value, fallback = "") {
  const raw = String(value || fallback || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function getWeatherRequestParams() {
  const strictFlight = getSelectedFlight();
  const rawFlight = getStoredFlight();
  const route = getStoredRoute();
  const dates = getStoredDates();
  const flight = rawFlight || strictFlight || {};

  const origin =
    extractAirportCode(flight.origin) ||
    extractAirportCode(flight.startingAirport) ||
    extractAirportCode(flight.departureAirport) ||
    extractAirportCode(route?.origin?.code) ||
    "";

  const destination =
    extractAirportCode(flight.destination) ||
    extractAirportCode(flight.destinationAirport) ||
    extractAirportCode(flight.arrivalAirport) ||
    extractAirportCode(route?.destination?.code) ||
    "";

  const date =
    normalizeDateForWeather(flight.date) ||
    normalizeDateForWeather(flight.flightDate) ||
    normalizeDateForWeather(flight.departureDate) ||
    normalizeDateForWeather(flight.departureTime) ||
    normalizeDateForWeather(dates.departure);

  return { origin, destination, date };
}

function setTextById(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
}

function applyWeatherToCard(payload) {
  if (!payload || !payload.departure || !payload.arrival) return;

  setTextById(
    "weatherDepartureTitle",
    `Departure (${payload.departure.city || payload.departure.airport || "Unknown"})`
  );
  setTextById(
    "weatherArrivalTitle",
    `Arrival (${payload.arrival.city || payload.arrival.airport || "Unknown"})`
  );

  setTextById("weatherDepartureTemp", `${Number(payload.departure.temperature ?? 0)}F`);
  setTextById("weatherDeparturePrecip", `${Number(payload.departure.precipitation ?? 0)}%`);
  setTextById("weatherDepartureWind", `${Number(payload.departure.windSpeed ?? 0)} mph`);

  setTextById("weatherArrivalTemp", `${Number(payload.arrival.temperature ?? 0)}F`);
  setTextById("weatherArrivalPrecip", `${Number(payload.arrival.precipitation ?? 0)}%`);
  setTextById("weatherArrivalWind", `${Number(payload.arrival.windSpeed ?? 0)} mph`);

  setTextById("weatherOverallScore", `Overall Weather Score: ${Number(payload.overallScore ?? 0)}%`);
  setTextById("weatherSourceLabel", ` - ${payload.source || "Estimated fallback"}`);
}

async function refreshWeatherForecast() {
  const { origin, destination, date } = getWeatherRequestParams();
  if (!origin || !destination || !date) {
    return;
  }

  const params = new URLSearchParams({ origin, destination, date });
  const weatherUrl = `${API_BASE}/api/weather-forecast?${params.toString()}`;
  console.log("[FlightSight] Request URL:", weatherUrl);

  try {
    const response = await fetch(weatherUrl);
    if (!response.ok) {
      console.error("[FlightSight] Weather forecast response error:", {
        url: weatherUrl,
        status: response.status,
        statusText: response.statusText,
      });
      return;
    }

    const payload = await response.json();
    applyWeatherToCard(payload);
  } catch (err) {
    console.error("[FlightSight] Weather forecast request failed:", {
      url: weatherUrl,
      error: err,
    });
  }
}


function applyBookingDataToUI(route, flight, dates) {
  const { origin, destination } = route;

  
  const flightInfo = document.querySelector(".flight-info");
  if (flightInfo && flight) {
    flightInfo.textContent = `${flight.airline} • ${flight.flightNumber}`;
  }

  
  if (flight) {
    // Departure
    const departureValue = document.querySelector(".flight-detail .detail-value");
    const departureSub = document.querySelector(".flight-detail .detail-sub");
    if (departureValue) departureValue.textContent = flight.departure.time;
    if (departureSub) departureSub.textContent = flight.departure.city;

    // Duration
    const durationValue = document.querySelector(".flight-detail.center .detail-value");
    const durationSub = document.querySelector(".flight-detail.center .detail-sub");
    if (durationValue) durationValue.textContent = flight.duration;
    if (durationSub) durationSub.textContent = flight.stops === 0 ? 'Nonstop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`;

    // Arrival
    const arrivalValue = document.querySelector(".flight-detail.right .detail-value");
    const arrivalSub = document.querySelector(".flight-detail.right .detail-sub");
    if (arrivalValue) arrivalValue.textContent = flight.arrival.time;
    if (arrivalSub) arrivalSub.textContent = flight.arrival.city;

    // Aircraft
    const aircraftEl = document.getElementById("aircraftValue");
    if (aircraftEl) aircraftEl.textContent = flight.airline || "Unknown";

    // Travel Date
    const travelDateEl = document.getElementById("travelDateValue");
    if (travelDateEl && flight.departureDate) {
      const date = new Date(flight.departureDate);
      travelDateEl.textContent = date.toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric"
      });
    }
  }

  
  const routeLabel =
    document.getElementById("routeLabel") ||
    document.querySelector("[data-route-label]");

  if (routeLabel) {
    routeLabel.textContent = `${origin.code} → ${destination.code}`;
  }

  
  const originTargets = [
    document.getElementById("origin"),
    document.getElementById("originInput"),
    document.querySelector("[data-route-origin]"),
  ].filter(Boolean);

  const destinationTargets = [
    document.getElementById("destination"),
    document.getElementById("destinationInput"),
    document.querySelector("[data-route-destination]"),
  ].filter(Boolean);

  // Fill origin
  originTargets.forEach((el) => {
    if ("value" in el) {
      el.value = origin.name; // show airport name
      el.readOnly = true;
      el.disabled = true; // prevents editing so it stays consistent
    } else {
      el.textContent = origin.name;
    }
  });

  // Fill destination
  destinationTargets.forEach((el) => {
    if ("value" in el) {
      el.value = destination.name;
      el.readOnly = true;
      el.disabled = true;
    } else {
      el.textContent = destination.name;
    }
  });


  const originCodeEl =
    document.getElementById("originCode") ||
    document.querySelector('input[name="originCode"]');

  const destinationCodeEl =
    document.getElementById("destinationCode") ||
    document.querySelector('input[name="destinationCode"]');

  if (originCodeEl) originCodeEl.value = origin.code;
  if (destinationCodeEl) destinationCodeEl.value = destination.code;

  
  window.flightSightRoute = route;
  window.flightSightFlight = flight;
  window.flightSightDates = dates;
}

function applySelectedFlightToBookingUI(flight) {
  console.log("[FlightSight] LOADING SELECTED FLIGHT in booking.js:", flight);
  
  const flightInfoLabel = document.querySelector(".flight-info");
  if (flightInfoLabel) {
    flightInfoLabel.textContent = `${flight.airline} - ${flight.legId || flight.flight}`;
  }

  const detailValues = document.querySelectorAll(".flight-summary-grid .detail-value");
  const detailSubs = document.querySelectorAll(".flight-summary-grid .detail-sub");

  if (detailValues[0]) detailValues[0].textContent = flight.departureTime || flight.depart || "N/A";
  if (detailValues[1]) detailValues[1].textContent = flight.travelDuration || flight.duration || "N/A";
  if (detailValues[2]) detailValues[2].textContent = flight.arrivalTime || flight.arrive || "N/A";

  if (detailSubs[0]) detailSubs[0].textContent = `${flight.origin}`;
  if (detailSubs[1]) detailSubs[1].textContent = Number(flight.stops) === 0 ? "Nonstop" : `${flight.stops} stop(s)`;
  if (detailSubs[2]) detailSubs[2].textContent = `${flight.destination}`;

  const travelDateRows = document.querySelectorAll(".flight-info-details .info-row");
  if (travelDateRows[1]) {
    const valueNode = travelDateRows[1].querySelector(".info-value");
    if (valueNode) valueNode.textContent = flight.departureDate;
  }

  // Airline
  const aircraftEl = document.getElementById("aircraftValue");
  if (aircraftEl) aircraftEl.textContent = flight.airline || "Unknown";

  // Travel Date
  const travelDateEl = document.getElementById("travelDateValue");
  if (travelDateEl && flight.departureDate) {
    const date = new Date(flight.departureDate);
    travelDateEl.textContent = date.toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric"
    });
  }

  const baseFareNode = document.querySelector(".price-row.base .price-amount");
  if (baseFareNode && typeof flight.totalFare === "number") {
    baseFareNode.textContent = `$${flight.totalFare.toFixed(2)}`;
  }

  // Price breakdown
  const fare = Number(flight.totalFare) || 0;
  const tax = Math.round(fare * 0.12);
  const total = fare + tax;

  const baseFareEl = document.getElementById("baseFareAmount");
  const taxEl = document.getElementById("taxAmount");
  const totalEl = document.getElementById("totalAmount");

  if (baseFareEl) baseFareEl.textContent = `$${fare.toFixed(2)}`;
  if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

  // Safety rating (derived from risk score same way as flightResults.js)
  const risk = Number(flight.delayCancellationRiskScore);
  const safeRisk = Number.isFinite(risk) ? Math.max(0, Math.min(100, risk)) : 50;
  const safety = Math.max(40, 100 - safeRisk);

  const safetyEl = document.getElementById("safetyValue");
  const safetyNoteEl = document.getElementById("safetyNote");
  if (safetyEl) safetyEl.textContent = `${safety}%`;
  if (safetyNoteEl) {
    safetyNoteEl.textContent =
      safety >= 90 ? "Excellent safety record" :
      safety >= 75 ? "Good safety record" :
      "Moderate safety record";
  }
  
  
  applyFlightMetricsToUI(flight);
}


function applyFlightMetricsToUI(flight) {
  if (!flight) return;

  // Safety Rating
  if (typeof flight.safety === "number") {
    const safetyElement = document.getElementById("safetyRatingValue");
    if (safetyElement) {
      safetyElement.textContent = `${flight.safety}%`;
      console.log("[FlightSight] Set Safety Rating to:", flight.safety);
    }
  }

  // Seat Availability
  if (typeof flight.seats === "number") {
    const seatAvailPercent = document.getElementById("seatAvailPercent");
    if (seatAvailPercent) {
      seatAvailPercent.textContent = `${flight.seats}%`;
      console.log("[FlightSight] Set Seat Availability to:", flight.seats);
    }
    
    const progressFill = document.getElementById("seatAvailBar");
    if (progressFill) {
      progressFill.style.width = `${flight.seats}%`;
    }
  }

  // CO2 Emissions
  if (typeof flight.co2 === "number") {
    const co2Element = document.getElementById("co2Big");
    if (co2Element) {
      co2Element.textContent = `${flight.co2} kg`;
      console.log("[FlightSight] Set CO2 Emissions to:", flight.co2);
    }
  }

  // Weather Score
  if (typeof flight.weather === "number") {
    const weatherScoreElement = document.getElementById("weatherOverallScore");
    if (weatherScoreElement) {
      weatherScoreElement.textContent = `Overall Weather Score: ${flight.weather}%`;
      console.log("[FlightSight] Set Weather Score to:", flight.weather);
    }
  }
  
  // Price 
  if (typeof flight.price === "number") {
    const priceElement = document.querySelector(".price-row.base .price-amount");
    if (priceElement) {
      priceElement.textContent = `$${flight.price.toFixed(2)}`;
      console.log("[FlightSight] Set Price to:", flight.price);
    }
  }
}


document.addEventListener("DOMContentLoaded", () => {
  console.log("[FlightSight] Booking page DOMContentLoaded");
  const selectedFlight = getSelectedFlight();
  console.log("[FlightSight] getSelectedFlight() returned:", selectedFlight);

  if (selectedFlight) {
    applySelectedFlightToBookingUI(selectedFlight);
    window.flightSightSelectedFlight = selectedFlight;
    console.log("[FlightSight] Applied selectedFlight to UI");
    return;
  }
  
  
  const rawFlight = getStoredFlight();
  if (rawFlight) {
    console.log("[FlightSight] Using raw stored flight:", rawFlight);
    applySelectedFlightToBookingUI(rawFlight);
    window.flightSightSelectedFlight = rawFlight;
    return;
  }

  const route = getStoredRoute();
  const flight = getStoredFlight();
  const dates = getStoredDates();

  // If someone enters Booking without selecting a route first:
  if (!route) {
    alert("Please select a flight first.");
    window.location.href = "calendar.html";
    return;
  }

  // If someone enters Booking without selecting a flight:
  if (!flight) {
    alert("Please select a flight first.");
    window.location.href = "flightResults.html";
    return;
  }

  applyBookingDataToUI(route, flight, dates);
});


async function refreshEmissions() {
  const selectedFlight = getSelectedFlight();
  const route = getStoredRoute();

  const origin = selectedFlight?.origin || route?.origin?.code || "";
  const destination = selectedFlight?.destination || route?.destination?.code || "";
  const airline = selectedFlight?.airline || "";

  console.log("Selected route:", origin || "N/A", "->", destination || "N/A");

  let emissionsPath = `${API_BASE}/emissions`;
  if (origin && destination) {
    const params = new URLSearchParams({
      origin,
      destination,
    });

    if (airline) {
      params.set("airline", airline);
    }

    emissionsPath = `${API_BASE}/emissions?${params.toString()}`;
  }

  console.log("[FlightSight] Request URL:", emissionsPath);

  let d;
  try {
    const response = await fetch(emissionsPath);
    if (!response.ok) {
      console.error("[FlightSight] Emissions API response error:", {
        url: emissionsPath,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`${emissionsPath} failed: ${response.status} ${response.statusText}`);
    }
    d = await response.json();
  } catch (err) {
    console.error("[FlightSight] Emissions fetch failed:", {
      url: emissionsPath,
      error: err,
    });
    throw err;
  }

  console.log("Emissions API response:", d);

  const co2Big = document.getElementById("co2Big");
  const co2Note = document.getElementById("co2Note");
  if (co2Big) co2Big.textContent = `${d.co2} kg`;
  if (co2Note) {
    const airline = selectedFlight?.airline || d.airline;
    co2Note.textContent = `Airline: ${airline}`;
  }
}

async function refreshSeatWeather() {
  // expects: { seat_status: "Available", weather: "Clear" }
  const d = await getJSON(`${API_BASE}/seatweather`);

  const seatPill = document.getElementById("seatPill");
  const weatherPill = document.getElementById("weatherPill");
  if (seatPill) seatPill.textContent = `Seats: ${d.seat_status}`;
  if (weatherPill) weatherPill.textContent = `Weather: ${d.weather}`;

  
  let pct = 60;
  if (String(d.seat_status).toLowerCase().includes("low")) pct = 25;
  if (String(d.seat_status).toLowerCase().includes("limited")) pct = 35;
  if (String(d.seat_status).toLowerCase().includes("available")) pct = 70;

  const seatBar = document.getElementById("seatBar");
  const seatPct = document.getElementById("seatPct");
  if (seatBar) seatBar.style.width = `${pct}%`;
  if (seatPct) seatPct.textContent = `${pct}%`;

  await refreshWeatherForecast();
}

async function runAnalysis() {
  
  const d = await getJSON(`${API_BASE}/analysis`);

  const analysisJson = document.getElementById("analysisJson");
  if (analysisJson) analysisJson.textContent = JSON.stringify(d, null, 2);

  const kpiAvgPrice = document.getElementById("kpiAvgPrice");
  const kpiCheapestCity = document.getElementById("kpiCheapestCity");
  const kpiBusiestMonth = document.getElementById("kpiBusiestMonth");

  if (kpiAvgPrice) kpiAvgPrice.textContent = d.avg_price != null ? `$${d.avg_price}` : "—";
  if (kpiCheapestCity) kpiCheapestCity.textContent = d.cheapest_city ?? "—";
  if (kpiBusiestMonth) kpiBusiestMonth.textContent = d.busiest_month ?? "—";
}

function getSelectedSeatSummary() {
  const selectedSeat = document.querySelector(".seat-option.selected");
  if (!selectedSeat) return null;

  const title = selectedSeat.querySelector(".seat-option-title")?.textContent?.trim();
  return title ? `Seat: ${title}` : null;
}

function getBaggageSummary() {
  const items = [];

  document.querySelectorAll(".baggage-option").forEach((option) => {
    const label = option.querySelector(".baggage-label")?.textContent?.trim();
    const countText = option.querySelector(".counter-value")?.textContent?.trim();
    const count = Number(countText);

    if (!label || !Number.isFinite(count)) return;
    if (label === "Checked Bags" && count <= 0) return;

    items.push(`${label}: ${count}`);
  });

  return items.length ? items.join(", ") : null;
}

function getServiceSummary() {
  const services = Array.from(document.querySelectorAll(".service-option.selected .service-title"))
    .map((title) => title.textContent?.trim())
    .filter(Boolean);

  return services.length ? `Services: ${services.join(", ")}` : null;
}

function buildAddOnsSummary() {
  const parts = [
    getSelectedSeatSummary(),
    getBaggageSummary(),
    getServiceSummary(),
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : null;
}

function updateBaggageOptionPrice(option, count) {
  const label = option.querySelector(".baggage-label")?.textContent?.trim();
  const priceLabel = option.querySelector(".baggage-price");
  if (!priceLabel) return;

  if (label === "Checked Bags") {
    priceLabel.textContent = count > 0 ? `$${count * 50}` : "None";
    return;
  }

  priceLabel.textContent = "Free";
}

function initializeBookingAddOnsUI() {
  document.querySelectorAll(".seat-option").forEach((option) => {
    option.addEventListener("click", () => {
      document.querySelectorAll(".seat-option").forEach((item) => item.classList.remove("selected"));
      option.classList.add("selected");
    });
  });

  document.querySelectorAll(".service-option").forEach((option) => {
    option.addEventListener("click", () => {
      option.classList.toggle("selected");
    });
  });

  document.querySelectorAll(".baggage-option").forEach((option) => {
    const buttons = option.querySelectorAll(".counter-button");
    const value = option.querySelector(".counter-value");
    if (buttons.length !== 2 || !value) return;

    const minusBtn = buttons[0];
    const plusBtn = buttons[1];
    const minCount = Number(value.textContent?.trim()) || 0;

    updateBaggageOptionPrice(option, minCount);

    minusBtn.addEventListener("click", () => {
      const current = Number(value.textContent?.trim()) || 0;
      const next = Math.max(minCount, current - 1);
      value.textContent = String(next);
      minusBtn.disabled = next <= minCount;
      updateBaggageOptionPrice(option, next);
    });

    plusBtn.addEventListener("click", () => {
      const current = Number(value.textContent?.trim()) || 0;
      const next = current + 1;
      value.textContent = String(next);
      minusBtn.disabled = next <= minCount;
      updateBaggageOptionPrice(option, next);
    });
  });
}

async function saveSelectedFlight() {
  const selectedFlight = getSelectedFlight();
  if (!selectedFlight) {
    alert("Please select a flight first.");
    return;
  }

  const co2Text = document.getElementById("co2Big")?.textContent?.trim() || null;
  const weatherText = document.getElementById("weatherPill")?.textContent?.trim() || null;
  const addOnsSummary = buildAddOnsSummary();

  const payload = {
    selectedFlight: {
      ...selectedFlight,
      emissions: co2Text,
      weather: weatherText,
      add_ons_summary: addOnsSummary,
    },
  };

  const saveUrl = "http://localhost:3000/api/saved-flights";
  console.log("[FlightSight] Save request URL:", saveUrl);
  console.log("[FlightSight] Save add_ons_summary:", addOnsSummary);
  console.log("[FlightSight] Save request payload:", payload);

  try {
    const response = await fetch(saveUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const rawBody = await response.text();
    let parsedBody;
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      parsedBody = rawBody;
    }

    console.log("[FlightSight] Save response status:", response.status, response.statusText);
    console.log("[FlightSight] Save response body:", parsedBody);

    if (!response.ok) {
      console.error("[FlightSight] Save flight response error:", {
        url: saveUrl,
        status: response.status,
        statusText: response.statusText,
        body: parsedBody,
      });
      alert("Failed to save flight.");
      return;
    }

    alert("Flight saved successfully.");
  } catch (err) {
    console.error("[FlightSight] Save flight request failed:", {
      url: saveUrl,
      error: err,
    });
    alert("Error saving flight.");
  }
}

async function createPriceAlert(threshold = 100) {
  const selectedFlight = getSelectedFlight();
  if (!selectedFlight) {
    alert("Please select a flight first.");
    return;
  }

  const payload = {
    userEmail: localStorage.getItem("userEmail") || "anonymous",
    origin: selectedFlight.origin,
    destination: selectedFlight.destination,
    departureDate: selectedFlight.departureDate,
    airline: selectedFlight.airline,
    stops: selectedFlight.stops,
    currentFare: selectedFlight.totalFare,
    threshold
  };

  try {
    const response = await fetch(`${API_BASE}/api/price-alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const bodyText = await response.text();
    let body = {};
    try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { body = {}; }

    if (response.status === 409) {
      setPriceAlertStatus("A price alert already exists for this route/date/airline.", "warn");
      return;
    }

    if (!response.ok) {
      setPriceAlertStatus(body.error || "Failed to create price alert.", "warn");
      return;
    }

    setPriceAlertStatus(`Price alert created (threshold = $${Number(threshold).toFixed(2)}). We'll watch for price drops.`, "success");
  } catch (err) {
    console.error("[FlightSight] Create price alert failed:", err);
    setPriceAlertStatus("Error creating price alert.", "warn");
  }
}

function setPriceAlertStatus(message, tone) {
  const status = document.getElementById("priceAlertStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.remove("price-alert-status--success", "price-alert-status--warn", "price-alert-status--info");
  if (tone === "success") status.classList.add("price-alert-status--success");
  else if (tone === "warn") status.classList.add("price-alert-status--warn");
  else status.classList.add("price-alert-status--info");
}

async function refreshPriceAlertBaseline() {
  const selectedFlight = getSelectedFlight();
  if (!selectedFlight) {
    setPriceAlertStatus("Set your own threshold to track this trip.", "info");
    return;
  }
  try {
    const userEmail = localStorage.getItem("userEmail") || "anonymous";
    const params = new URLSearchParams({
      userEmail,
      currentFare: String(selectedFlight.totalFare ?? "")
    });
    const r = await fetch(`${API_BASE}/api/price-alerts/evaluate?${params.toString()}`);
    if (!r.ok) throw new Error(`evaluate failed: ${r.status}`);
    const data = await r.json();
    const match = (data.alerts || []).find(a =>
      a.origin === selectedFlight.origin &&
      a.destination === selectedFlight.destination &&
      a.departureDate === selectedFlight.departureDate &&
      a.airline === selectedFlight.airline
    );
    if (match && typeof match.baselineFare === "number" && typeof selectedFlight.totalFare === "number") {
      const diff = selectedFlight.totalFare - match.baselineFare;
      if (diff > 0) {
        setPriceAlertStatus(`Price is above usual by $${diff.toFixed(2)} (baseline $${match.baselineFare.toFixed(2)}).`, "warn");
      } else if (diff < 0) {
        setPriceAlertStatus(`Price is below usual by $${Math.abs(diff).toFixed(2)} (baseline $${match.baselineFare.toFixed(2)}).`, "success");
      } else {
        setPriceAlertStatus(`Price matches baseline ($${match.baselineFare.toFixed(2)}).`, "info");
      }
    } else {
      setPriceAlertStatus("Set your own threshold to track this trip.", "info");
    }
  } catch {
    setPriceAlertStatus("Set your own threshold to track this trip.", "info");
  }
}

function ensurePriceAlertButton() {
  const actionButtons = document.querySelector(".action-buttons");
  if (!actionButtons) return;
  if (document.getElementById("btnPriceAlert")) return;

  // Visible status message (always rendered, with graceful fallback)
  if (!document.getElementById("priceAlertStatus")) {
    const status = document.createElement("div");
    status.id = "priceAlertStatus";
    status.className = "price-alert-status price-alert-status--info";
    status.textContent = "Set your own threshold to track this trip.";
    actionButtons.insertBefore(status, actionButtons.firstChild);
  }

  if (!document.getElementById("priceAlertControls")) {
    const controls = document.createElement("div");
    controls.id = "priceAlertControls";
    controls.style.display = "inline-flex";
    controls.style.alignItems = "center";
    controls.style.gap = "8px";

    const input = document.createElement("input");
    input.id = "priceAlertThreshold";
    input.type = "number";
    input.min = "1";
    input.step = "1";
    input.placeholder = "Target price";
    input.setAttribute("aria-label", "Price alert threshold");
    input.style.height = "36px";
    input.style.padding = "0 10px";
    input.style.border = "1px solid #d1d5db";
    input.style.borderRadius = "8px";
    input.style.width = "150px";

    const btn = document.createElement("button");
    btn.id = "btnPriceAlert";
    btn.className = "btn-secondary";
    btn.type = "button";
    btn.textContent = "Set Price Alert";
    btn.addEventListener("click", async () => {
      const threshold = Number(input.value);
      if (!Number.isFinite(threshold) || threshold <= 0) {
        setPriceAlertStatus("Please enter a valid threshold above $0.", "warn");
        return;
      }
      await createPriceAlert(threshold);
      refreshPriceAlertBaseline();
    });

    controls.appendChild(input);
    controls.appendChild(btn);

    const btnSaveFlight = document.querySelector(".btn-primary");
    if (btnSaveFlight && btnSaveFlight.parentNode === actionButtons) {
      actionButtons.insertBefore(controls, btnSaveFlight.nextSibling);
    } else {
      actionButtons.appendChild(controls);
    }
  }

  refreshPriceAlertBaseline();
}


const btnEmissions = document.getElementById("btnEmissions");
const btnSeatWeather = document.getElementById("btnSeatWeather");
const btnAnalysis = document.getElementById("btnAnalysis");
const btnSaveFlight = document.querySelector(".btn-primary");

if (btnEmissions) btnEmissions.addEventListener("click", refreshEmissions);
if (btnSeatWeather) btnSeatWeather.addEventListener("click", refreshSeatWeather);
if (btnAnalysis) btnAnalysis.addEventListener("click", runAnalysis);
if (btnSaveFlight) btnSaveFlight.addEventListener("click", saveSelectedFlight);

initializeBookingAddOnsUI();
ensurePriceAlertButton();


Promise.allSettled([refreshEmissions(), refreshSeatWeather(), runAnalysis(), refreshWeatherForecast()]);
