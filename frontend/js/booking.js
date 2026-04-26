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

// Helper function to format ISO date strings into a more user-friendly format (e.g., "3:45 PM")
function formatDateTime(isoString) {
  if (!isoString) return { date: "N/A", time: "N/A" };
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return { date: isoString, time: "" };
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  };
}

let baseFare = 0;
let currentCarryOnCount = 0;
let currentCheckedCount = 0;
/**
 * Try to inject route, flight, and dates into the Booking page UI.
 * This is defensive: it only updates elements if they exist.
 */
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

  const dep = formatDateTime(flight.departureTime);
  const arr = formatDateTime(flight.arrivalTime);
  if (detailValues[0]) detailValues[0].innerHTML = `${dep.date}<br><span style="font-weight:400; color:#6b7280;">${dep.time}</span>`;
  if (detailValues[1]) detailValues[1].textContent = flight.travelDuration || "N/A";
  if (detailValues[2]) detailValues[2].innerHTML = `${arr.date}<br><span style="font-weight:400; color:#6b7280;">${arr.time}</span>`;

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
  baseFare = fare;
  const tax = Math.round(fare * 0.12);
  const total = fare + tax;

  const baseFareEl = document.getElementById("baseFareAmount");
  const taxEl = document.getElementById("taxAmount");
  const totalEl = document.getElementById("totalAmount");

  if (baseFareEl) baseFareEl.textContent = `$${fare.toFixed(2)}`;
  if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

  // Seat availability
  const seatTextEl = document.getElementById("seatAvailText");
  if (seatTextEl) seatTextEl.textContent = flight.seatAvailability || "Unknown";

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

  // Apply baggage and services if you have them
  applyAirlineBaggageAndServices(flight);
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

  // ── Read current baggage counts from the DOM ──
  const carryOnCount = currentCarryOnCount;
  const checkedCount = currentCheckedCount;
  // ── Read selected services from the DOM ──
  const wifiSelected   = document.querySelector("[data-service='wifi']")?.classList.contains("service-selected") ?? false;
  const mealSelected   = document.querySelector("[data-service='meal']")?.classList.contains("service-selected") ?? false;
  const insuranceSelected = document.querySelector("[data-service='insurance']")?.classList.contains("service-selected") ?? false;

  // ── Calculate add-on costs ──
  const airlineData = getAirlineData(selectedFlight.airline);
  let carryOnCost = 0;
  let checkedCost = 0;

  if (airlineData) {
    if (airlineData.add_carryOn > 0) carryOnCost = carryOnCount * airlineData.add_carryOn;
    if (checkedCount >= 1) checkedCost += airlineData.add_checkedIn_1st;
    if (checkedCount >= 2) checkedCost += (checkedCount - 1) * airlineData.add_checkedIn_2nd;
  }

  const wifiCost      = wifiSelected && airlineData?.wifi_cost > 0 ? airlineData.wifi_cost : 0;
  const mealCost      = mealSelected ? (airlineData?.premium_meal_cost ?? 0) : 0;
  const insuranceCost = insuranceSelected ? (airlineData?.travel_insurance_cost ?? 0) : 0;

  const tax   = Math.round(baseFare * 0.12);
  const total = baseFare + tax + carryOnCost + checkedCost + wifiCost + mealCost + insuranceCost;

  const payload = {
    selectedFlight: {
      ...selectedFlight,
      emissions: co2Text,
      weather: weatherText,
      // ── Add-ons ──
      addOnsSummary: JSON.stringify({
        carryOnBags: carryOnCount,
        carryOnCost,
        checkedBags: checkedCount,
        checkedCost,
        wifi: wifiSelected,
        wifiCost,
        meal: mealSelected,
        mealCost,
        insurance: insuranceSelected,
        insuranceCost,
        totalWithAddOns: total,
      })},
  };

  console.log("[FlightSight] addOnsSummary being saved:", JSON.stringify({
    carryOnCount,
    checkedCount,
    wifiSelected,
    mealSelected,
    insuranceSelected,
  }));

  console.log("[FlightSight] Full addOnsSummary string:", payload.selectedFlight.addOnsSummary);

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
  const btn = document.getElementById("btnPriceAlert");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const input = document.getElementById("priceAlertThreshold");
    const threshold = Number(input?.value);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      setPriceAlertStatus("Please enter a valid threshold above $0.", "warn");
      return;
    }
    await createPriceAlert(threshold);
    refreshPriceAlertBaseline();
  });

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




// BAGGAGE AND ADDITIONAL SERVICES
const AIRLINE_DATA = {
  "Delta": { add_carryOn: 0, max_carryOn: 1, add_checkedIn_1st: 45, add_checkedIn_2nd: 55, max_checkedIn: 10, hasWifi: true, wifi_cost: 0, premium_meal_cost: 15, travel_insurance_cost: 25 },
  "Alaska Airlines": { add_carryOn: 0, max_carryOn: 1, add_checkedIn_1st: 35, add_checkedIn_2nd: 45, max_checkedIn: 10, hasWifi: true, wifi_cost: 8, premium_meal_cost: 12, travel_insurance_cost: 20 },
  "American Airlines": { add_carryOn: 0, max_carryOn: 1, add_checkedIn_1st: 50, add_checkedIn_2nd: 60, max_checkedIn: 10, hasWifi: true, wifi_cost: 10, premium_meal_cost: 15, travel_insurance_cost: 22 },
  "United Airlines": { add_carryOn: 0, max_carryOn: 1, add_checkedIn_1st: 45, add_checkedIn_2nd: 55, max_checkedIn: 10, hasWifi: true, wifi_cost: 0, premium_meal_cost: 15, travel_insurance_cost: 22 },
  "Southern Airways Express": { add_carryOn: 0, max_carryOn: 1, add_checkedIn_1st: 35, add_checkedIn_2nd: 45, max_checkedIn: 2, hasWifi: false, wifi_cost: 0, premium_meal_cost: 0, travel_insurance_cost: 0 },
  "JetBlue Airways": { add_carryOn: 0, max_carryOn: 1, add_checkedIn_1st: 39, add_checkedIn_2nd: 50, max_checkedIn: 10, hasWifi: true, wifi_cost: 0, premium_meal_cost: 12, travel_insurance_cost: 20 },
  "Frontier Airlines": { add_carryOn: 75, max_carryOn: 1, add_checkedIn_1st: 55, add_checkedIn_2nd: 75, max_checkedIn: 10, hasWifi: false, wifi_cost: 0, premium_meal_cost: 0, travel_insurance_cost: 0 },
  "Cape Air": { add_carryOn: 0, max_carryOn: 1, add_checkedIn_1st: 50, add_checkedIn_2nd: 75, max_checkedIn: 2, hasWifi: false, wifi_cost: 0, premium_meal_cost: 0, travel_insurance_cost: 0 },
  "Key Lime Air": { add_carryOn: 0, max_carryOn: 1, add_checkedIn_1st: 50, add_checkedIn_2nd: 75, max_checkedIn: 1, hasWifi: false, wifi_cost: 0, premium_meal_cost: 0, travel_insurance_cost: 0 },
  "Contour Airlines": { add_carryOn: 0, max_carryOn: 1, add_checkedIn_1st: 35, add_checkedIn_2nd: 45, max_checkedIn: 2, hasWifi: false, wifi_cost: 0, premium_meal_cost: 0, travel_insurance_cost: 0 },
  "Boutique Air": { add_carryOn: 0, max_carryOn: 1, add_checkedIn_1st: 50, add_checkedIn_2nd: 75, max_checkedIn: 1, hasWifi: false, wifi_cost: 0, premium_meal_cost: 0, travel_insurance_cost: 0 },
  "Sun Country Airlines": { add_carryOn: 35, max_carryOn: 1, add_checkedIn_1st: 35, add_checkedIn_2nd: 45, max_checkedIn: 10, hasWifi: false, wifi_cost: 0, premium_meal_cost: 0, travel_insurance_cost: 15 },
  "Silver Airways": { add_carryOn: 0, max_carryOn: 1, add_checkedIn_1st: 30, add_checkedIn_2nd: 40, max_checkedIn: 10, hasWifi: false, wifi_cost: 0, premium_meal_cost: 0, travel_insurance_cost: 0 },
  "Hawaiian Airlines": { add_carryOn: 0, max_carryOn: 1, add_checkedIn_1st: 45, add_checkedIn_2nd: 55, max_checkedIn: 10, hasWifi: true, wifi_cost: 0, premium_meal_cost: 15, travel_insurance_cost: 22 },
};

function getAirlineData(airlineName) {
  if (!airlineName) return null;
  // Try exact match first, then partial
  if (AIRLINE_DATA[airlineName]) return AIRLINE_DATA[airlineName];
  const key = Object.keys(AIRLINE_DATA).find(k =>
    airlineName.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(airlineName.toLowerCase())
  );
  return key ? AIRLINE_DATA[key] : null;
}

function applyAirlineBaggageAndServices(flight) {
  const data = getAirlineData(flight.airline);
  if (!data) return;

  // ---- BAGGAGE ----
  const baggageContent = document.getElementById("baggageSection");
  if (baggageContent) {
    let carryOnCount = data.add_carryOn === 0 ? 1 : 0;
    let checkedCount = 0;
    currentCarryOnCount = carryOnCount; // initialize outer scope too
    currentCheckedCount = checkedCount;

    function carryOnCost(count) {
      if (data.add_carryOn === 0) return "Free";
      return count === 0 ? "$0" : `$${data.add_carryOn}`;
    }

    function checkedCost(count) {
      if (count === 0) return "None";
      if (count === 1) return `$${data.add_checkedIn_1st}`;
      return `$${data.add_checkedIn_1st + (count - 1) * data.add_checkedIn_2nd}`;
    }

    function renderBaggage() {
      baggageContent.innerHTML = `
        <div class="baggage-option">
          <div class="baggage-header">
            <label class="baggage-label">Carry-on Bags</label>
            <span class="baggage-note">${data.add_carryOn === 0 ? "1 included free" : `$${data.add_carryOn} per bag`}</span>
          </div>
          <div class="baggage-controls">
            <button class="counter-button" id="carryOnMinus" ${carryOnCount <= (data.add_carryOn === 0 ? 1 : 0) ? "disabled" : ""}>-</button>
            <span class="counter-value" id="carryOnCount">${carryOnCount}</span>
            <button class="counter-button" id="carryOnPlus" ${carryOnCount >= data.max_carryOn ? "disabled" : ""}>+</button>
            <span class="baggage-price" id="carryOnPrice">${carryOnCost(carryOnCount)}</span>
          </div>
        </div>
        <div class="baggage-option">
          <div class="baggage-header">
            <label class="baggage-label">Checked Bags</label>
            <span class="baggage-note">1st: $${data.add_checkedIn_1st} · 2nd+: $${data.add_checkedIn_2nd}</span>
          </div>
          <div class="baggage-controls">
            <button class="counter-button" id="checkedMinus" ${checkedCount <= 0 ? "disabled" : ""}>-</button>
            <span class="counter-value" id="checkedCount">${checkedCount}</span>
            <button class="counter-button" id="checkedPlus" ${checkedCount >= data.max_checkedIn ? "disabled" : ""}>+</button>
            <span class="baggage-price" id="checkedPrice">${checkedCost(checkedCount)}</span>
          </div>
        </div>
      `;

      document.getElementById("carryOnMinus").addEventListener("click", () => {
        const min = data.add_carryOn === 0 ? 1 : 0;
        if (carryOnCount > min) {
          carryOnCount--;
          currentCarryOnCount = carryOnCount; // sync to outer scope
          renderBaggage();
          recalculateTotal();
        }
      });
      document.getElementById("carryOnPlus").addEventListener("click", () => {
        if (carryOnCount < data.max_carryOn) {
          carryOnCount++;
          currentCarryOnCount = carryOnCount; // sync to outer scope
          renderBaggage();
          recalculateTotal();
        }
      });
      document.getElementById("checkedMinus").addEventListener("click", () => {
        if (checkedCount > 0) {
          checkedCount--;
          currentCheckedCount = checkedCount; // sync to outer scope
          renderBaggage();
          recalculateTotal();
        }
      });
      document.getElementById("checkedPlus").addEventListener("click", () => {
        if (checkedCount < data.max_checkedIn) {
          checkedCount++;
          currentCheckedCount = checkedCount; // sync to outer scope
          renderBaggage();
          recalculateTotal();
        }
      });
    }

    renderBaggage();
  }

  // ---- ADDITIONAL SERVICES ----
  const servicesContent = document.getElementById("servicesSection");
  if (!servicesContent) return;

  const services = [
    {
      key: "wifi",
      show: data.hasWifi,
      title: "In-Flight WiFi",
      desc: "Full flight connectivity",
      cost: data.wifi_cost,
      free: data.wifi_cost === 0
    },
    {
      key: "meal",
      show: data.premium_meal_cost > 0,
      title: "Premium Meal",
      desc: "Chef-curated dining experience",
      cost: data.premium_meal_cost,
      free: false
    },
    {
      key: "insurance",
      show: data.travel_insurance_cost > 0,
      title: "Travel Insurance",
      desc: "Comprehensive coverage for your trip",
      cost: data.travel_insurance_cost,
      free: false
    },
  ];

  // Auto-select free services
  const serviceSelected = {
    wifi: data.hasWifi && data.wifi_cost === 0,
    meal: false,
    insurance: false,
  };

  function renderServices() {
    servicesContent.innerHTML = services.map(s => {
      if (!s.show) return ""; // hide unavailable entirely

      const isSelected = serviceSelected[s.key];
      const priceLabel = s.free ? "Free (Included)" : `+$${s.cost}`;

      return `
        <div class="service-option ${isSelected ? "service-selected" : ""}"
          data-service="${s.key}"
          style="cursor: ${s.free ? 'default' : 'pointer'};"
        >
          <div class="service-content">
            <div class="service-info">
              <div>
                <p class="service-title">${s.title}</p>
                <p class="service-desc">${s.desc}</p>
              </div>
            </div>
            <div class="service-price-box">
              <p class="service-price">${priceLabel}</p>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Wire click — only once, only for paid services
    servicesContent.querySelectorAll("[data-service]").forEach(el => {
      const key = el.dataset.service;
      const service = services.find(s => s.key === key);
      if (!service || service.free) return;

      el.addEventListener("click", () => {
        serviceSelected[key] = !serviceSelected[key];
        el.classList.toggle("service-selected", serviceSelected[key]);
        recalculateTotal();
      });
    });
  }

  renderServices();
}


function recalculateTotal() {
  const tax = Math.round(baseFare * 0.12);

  const carryOnCount = Number(document.getElementById("carryOnCount")?.textContent) || 0;
  const checkedCount = Number(document.getElementById("checkedCount")?.textContent) || 0;

  const airlineName = getSelectedFlight()?.airline || "";
  const data = getAirlineData(airlineName);

  let carryOnCost = 0;
  let checkedCost = 0;

  if (data) {
    // Carry-on cost — only if airline charges
    if (data.add_carryOn > 0) {
      carryOnCost = carryOnCount * data.add_carryOn;
    }
    // Checked cost — 1st bag + 2nd+ bags
    if (checkedCount >= 1) checkedCost += data.add_checkedIn_1st;
    if (checkedCount >= 2) checkedCost += (checkedCount - 1) * data.add_checkedIn_2nd;
  }

  // Show/hide carry-on row
  const carryOnRow = document.getElementById("carryOnRow");
  if (carryOnRow) {
    if (carryOnCost > 0) {
      carryOnRow.classList.remove("hidden");
      document.getElementById("carryOnRowLabel").textContent = `Carry-on (${carryOnCount}x)`;
      document.getElementById("carryOnRowAmount").textContent = `$${carryOnCost.toFixed(2)}`;
    } else {
      carryOnRow.classList.add("hidden");
    }
  }

  // Show/hide checked bags row
  const checkedRow = document.getElementById("checkedRow");
  if (checkedRow) {
    if (checkedCount > 0) {
      checkedRow.classList.remove("hidden");
      document.getElementById("checkedRowLabel").textContent = `Checked Bags (${checkedCount}x)`;
      document.getElementById("checkedRowAmount").textContent = `$${checkedCost.toFixed(2)}`;
    } else {
      checkedRow.classList.add("hidden");
    }
  }

  // Services
  let servicesCost = 0;

  const wifiEl = document.querySelector("[data-service='wifi']");
  const mealEl = document.querySelector("[data-service='meal']");
  const insuranceEl = document.querySelector("[data-service='insurance']");

  const wifiRow = document.getElementById("wifiRow");
  const mealRow = document.getElementById("mealRow");
  const insuranceRow = document.getElementById("insuranceRow");

  if (data && wifiEl?.classList.contains("service-selected") && data.wifi_cost > 0) {
    servicesCost += data.wifi_cost;
    if (wifiRow) {
      wifiRow.classList.remove("hidden");
      document.getElementById("wifiRowAmount").textContent = `$${data.wifi_cost.toFixed(2)}`;
    }
  } else if (wifiRow) wifiRow.classList.add("hidden");

  if (data && mealEl?.classList.contains("service-selected")) {
    servicesCost += data.premium_meal_cost;
    if (mealRow) {
      mealRow.classList.remove("hidden");
      document.getElementById("mealRowAmount").textContent = `$${data.premium_meal_cost.toFixed(2)}`;
    }
  } else if (mealRow) mealRow.classList.add("hidden");

  if (data && insuranceEl?.classList.contains("service-selected")) {
    servicesCost += data.travel_insurance_cost;
    if (insuranceRow) {
      insuranceRow.classList.remove("hidden");
      document.getElementById("insuranceRowAmount").textContent = `$${data.travel_insurance_cost.toFixed(2)}`;
    }
  } else if (insuranceRow) insuranceRow.classList.add("hidden");

  const total = baseFare + tax + carryOnCost + checkedCost + servicesCost;

  const taxEl = document.getElementById("taxAmount");
  const totalEl = document.getElementById("totalAmount");
  if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
}
