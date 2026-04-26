// flightResults.js - handles the flight results page, including fetching predicted flights, applying filters, and rendering the flight list with safety and environmental metrics.
const $ = (id) => document.getElementById(id);

function safe(v) {
  return String(v ?? "").replace(/[<>&]/g, (c) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;"
  }[c]));
}

function formatDateRange(depart, ret) {
  if (!depart && !ret) return "—";
  if (depart && ret) return `${depart} → ${ret}`;
  return depart || ret;
}

function formatStoredDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function durationToMinutes(d) {
  const h = /(\d+)\s*h/.exec(d)?.[1] ? Number(/(\d+)\s*h/.exec(d)[1]) : 0;
  const m = /(\d+)\s*m/.exec(d)?.[1] ? Number(/(\d+)\s*m/.exec(d)[1]) : 0;
  return h * 60 + m;
}

function badgeClassForPct(p) {
  if (p >= 90) return "green";
  if (p >= 70) return "blue";
  return "amber";
}

function badgeClassForCo2(kg) {
  if (kg <= 240) return "green";
  if (kg <= 300) return "blue";
  return "amber";
}

const airportData = {
  "New York": { city: "New York", code: "JFK", country: "USA", lat: 40.64, lon: -73.78 },
  "Chicago": { city: "Chicago", code: "ORD", country: "USA", lat: 41.97, lon: -87.91 },
  "Los Angeles": { city: "Los Angeles", code: "LAX", country: "USA", lat: 33.94, lon: -118.40 },
  "London": { city: "London", code: "LHR", country: "United Kingdom", lat: 51.47, lon: -0.45 },
  "Tokyo": { city: "Tokyo", code: "NRT", country: "Japan", lat: 35.77, lon: 140.39 },
  "Paris": { city: "Paris", code: "CDG", country: "France", lat: 49.01, lon: 2.55 },
  "Frankfurt": { city: "Frankfurt", code: "FRA", country: "Germany", lat: 50.03, lon: 8.57 },
  "Dubai": { city: "Dubai", code: "DXB", country: "UAE", lat: 25.25, lon: 55.36 },
  "Singapore": { city: "Singapore", code: "SIN", country: "Singapore", lat: 1.36, lon: 103.99 }
};

function getAirportInfo(name, fallbackCode = "—") {
  return airportData[name] || {
    city: name,
    code: fallbackCode,
    country: "Unknown",
    lat: 0,
    lon: 0
  };
}

function formatCoords(lat, lon) {
  return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => deg * Math.PI / 180;
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function estimateFlightTime(distanceKm) {
  const avgSpeed = 850;
  const totalHours = distanceKm / avgSpeed + 2;
  return `${Math.round(totalHours)} hrs`;
}

function getDirection(origin, destination) {
  const lonDiff = destination.lon - origin.lon;
  const latDiff = destination.lat - origin.lat;

  if (Math.abs(lonDiff) >= Math.abs(latDiff)) {
    return lonDiff >= 0 ? "Eastbound" : "Westbound";
  }

  return latDiff >= 0 ? "Northbound" : "Southbound";
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

function getStoredDates() {
  return {
    departure: localStorage.getItem("departureDate") || "",
    return: localStorage.getItem("returnDate") || ""
  };
}

function getDisplayName(airportObj, fallback = "—") {
  if (!airportObj) return fallback;
  return airportObj.name || airportObj.city || airportObj.code || fallback;
}

function getDisplayCode(airportObj, fallback = "—") {
  if (!airportObj) return fallback;
  return airportObj.code || fallback;
}

const params = new URLSearchParams(window.location.search);
const storedRoute = getStoredRoute();
const storedDates = getStoredDates();

if (!storedRoute && !params.get("origin") && !params.get("destination")) {
  alert("Please select a route first.");
  window.location.href = "flightRoute.html";
  throw new Error("No route selected");
}

const originName =
  storedRoute?.origin ? getDisplayName(storedRoute.origin) : (params.get("origin") || "Los Angeles");

const destinationName =
  storedRoute?.destination ? getDisplayName(storedRoute.destination) : (params.get("destination") || "London");

const departureDate =
  storedDates.departure ? formatStoredDate(storedDates.departure) : (params.get("depart") || "Mar 14, 2026");

const returnDate =
  storedDates.return ? formatStoredDate(storedDates.return) : (params.get("return") || "Mar 28, 2026");

const originCode =
  storedRoute?.origin ? getDisplayCode(storedRoute.origin, "ORG") : getAirportInfo(originName, "ORG").code;

const destinationCode =
  storedRoute?.destination ? getDisplayCode(storedRoute.destination, "DST") : getAirportInfo(destinationName, "DST").code;

const API_BASE_RESULTS = "http://localhost:3000";

$("routeText").textContent = `${originName} → ${destinationName}`;
$("dateRange").textContent = formatDateRange(departureDate, returnDate);

const flights = [
  {
    id: "JB1",
    airline: "JetBlue Airways",
    flight: "JE1092",
    aircraft: "Boeing 737",
    depart: "10:00 AM",
    departCode: originCode,
    arrive: "2:15 PM",
    arriveCode: destinationCode,
    duration: "5h 0m",
    stops: 1,
    price: 403,
    safety: 89,
    co2: 273,
    weather: 89,
    seats: 40,
    score: 64
  },
  {
    id: "DL1",
    airline: "Delta Air Lines",
    flight: "DE1023",
    aircraft: "Airbus A320",
    depart: "7:30 AM",
    departCode: originCode,
    arrive: "11:45 AM",
    arriveCode: destinationCode,
    duration: "3h 15m",
    stops: 1,
    price: 507,
    safety: 80,
    co2: 236,
    weather: 67,
    seats: 98,
    score: 64
  },
  {
    id: "AS1",
    airline: "Alaska Airlines",
    flight: "AL1115",
    aircraft: "Airbus A320",
    depart: "11:30 AM",
    departCode: originCode,
    arrive: "3:45 PM",
    arriveCode: destinationCode,
    duration: "5h 15m",
    stops: 2,
    price: 524,
    safety: 98,
    co2: 284,
    weather: 76,
    seats: 90,
    score: 67
  },
  {
    id: "UA1",
    airline: "United Airlines",
    flight: "UN1138",
    aircraft: "Boeing 787",
    depart: "12:00 PM",
    departCode: originCode,
    arrive: "4:15 PM",
    arriveCode: destinationCode,
    duration: "6h 30m",
    stops: 0,
    price: 557,
    safety: 82,
    co2: 261,
    weather: 67,
    seats: 67,
    score: 59
  },
  {
    id: "UA0",
    airline: "United Airlines",
    flight: "UN1000",
    aircraft: "Boeing 737",
    depart: "6:00 AM",
    departCode: originCode,
    arrive: "10:15 AM",
    arriveCode: destinationCode,
    duration: "3h 0m",
    stops: 0,
    price: 374,
    safety: 100,
    co2: 350,
    weather: 86,
    seats: 60,
    score: 65
  }
];

function normalizeApiCode(rawCode, fallback) {
  const code = String(rawCode || "").trim().toUpperCase();
  return code ? code : fallback;
}

function toShortTime(isoOrTime) {
  if (!isoOrTime) return "—";

  const raw = String(isoOrTime);
  const isoMatch = raw.match(/T(\d{2}):(\d{2})/);
  if (isoMatch) {
    const hour24 = Number(isoMatch[1]);
    const minute = isoMatch[2];
    const hour12 = ((hour24 + 11) % 12) + 1;
    const suffix = hour24 >= 12 ? "PM" : "AM";
    return `${hour12}:${minute} ${suffix}`;
  }

  return raw;
}

function parseSeatPercent(seatAvailability) {
  const match = String(seatAvailability || "").match(/(\d+)/);
  if (!match) return 60;
  const seats = Number(match[1]);
  if (!Number.isFinite(seats)) return 60;
  return Math.max(5, Math.min(100, Math.round((seats / 60) * 100)));
}

function seatAvailScore(seatAvail) {
  if (seatAvail === "High availability") return 100;
  if (seatAvail === "Moderate availability") return 70;
  if (seatAvail === "Low availability") return 40;
  if (seatAvail === "Very limited") return 15;
  return 60; // fallback
}

function computeUiScore(flight) {
  const stopPenalty = Math.min(30, Number(flight.stops || 0) * 12);
  const normalizedPrice = Math.min(35, Math.round(Number(flight.price || 0) / 25));
  const seatScore = seatAvailScore(flight.seats);
  return Math.max(1, Math.min(100, Math.round(
    (flight.safety * 0.4) +
    (flight.weather * 0.2) +
    (seatScore * 0.2) +
    (100 - normalizedPrice) * 0.2 -
    stopPenalty * 0.1
  )));
}

function adaptPredictFlight(p, index, realWeatherScore = null) {
  const risk = Number(p.delayCancellationRiskScore);
  const safeRisk = Number.isFinite(risk) ? Math.max(0, Math.min(100, risk)) : 50;
  const safety = Math.max(40, 100 - safeRisk);
  const weather = realWeatherScore !== null
    ? realWeatherScore
    : Math.max(45, 98 - Math.round(safeRisk * 0.6));
  const seats = p.seatAvailability || "Unknown";
  const co2 = Math.max(160, 220 + Number(p.stops || 0) * 45 + Math.round(safeRisk * 0.6));

  const adapted = {
    id: p.legId || `PRED-${index + 1}`,
    airline: p.airline || "Unknown Airline",
    flight: (p.legId || `PRED${index + 1}`).toString().slice(0, 10).toUpperCase(),
    aircraft: p.isPredicted ? "Predicted" : "Unknown",
    depart: toShortTime(p.departureTime),
    departCode: normalizeApiCode(p.origin, originCode),
    arrive: toShortTime(p.arrivalTime),
    arriveCode: normalizeApiCode(p.destination, destinationCode),
    // ✅ Use actual ML values directly
    duration: p.travelDuration || p.flightTime || "—",
    stops: Number.isFinite(Number(p.stops)) ? Number(p.stops) : 0,
    price: Number(p.totalFare) || 0,
    safety,
    co2,
    weather,
    seats,
    score: 0,
    _rawStops: p.stops, // keep original for filter
    _predictShape: {
      legId: p.legId,
      origin: p.origin,
      destination: p.destination,
      departureDate: p.departureDate,
      airline: p.airline,
      totalFare: Number(p.totalFare) || 0,
      travelDuration: p.travelDuration ?? null,
      flightTime: p.flightTime ?? null,
      layoverTime: p.layoverTime ?? null,
      stops: Number(p.stops) || 0,
      seatAvailability: p.seatAvailability ?? "Unknown",
      confidence: p.confidence ?? "Unknown",
      departureTime: p.departureTime ?? null,
      arrivalTime: p.arrivalTime ?? null,
      isPredicted: p.isPredicted === true,
      delayCancellationRiskScore: p.delayCancellationRiskScore,
      riskBand: p.riskBand,
      riskExplanation: p.riskExplanation,
    }
  };

  adapted.score = computeUiScore(adapted);
  return adapted;
}

function getPredictRequestValues() {
  const fallbackOrigin = normalizeApiCode(params.get("origin"), originCode);
  const fallbackDestination = normalizeApiCode(params.get("destination"), destinationCode);
  const storedDeparture = String(storedDates.departure || "").slice(0, 10);
  const urlDeparture = String(params.get("depart") || "").slice(0, 10);

  const origin = normalizeApiCode(storedRoute?.origin?.code, fallbackOrigin);
  const destination = normalizeApiCode(storedRoute?.destination?.code, fallbackDestination);
  const departureDate = storedDeparture || urlDeparture;

  return { origin, destination, departureDate };
}

async function loadLiveFlights() {
  const { origin, destination, departureDate } = getPredictRequestValues();

  if (!origin || !destination || !departureDate) return;

  try {
    const query = new URLSearchParams({ origin, destination, departureDate });
    const url = `${API_BASE_RESULTS}/api/flights/predict?${query.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn("[FlightSight] /api/flights/predict failed:", response.status);
      return;
    }

    const payload = await response.json();
    const predictedFlights = Array.isArray(payload?.flights) ? payload.flights : [];
    if (!predictedFlights.length) return;

    // Fetch real weather score from Open-Meteo via your backend
    let realWeatherScore = null;
    try {
      const weatherParams = new URLSearchParams({ origin, destination, date: departureDate });
      const weatherRes = await fetch(`${API_BASE_RESULTS}/api/weather-forecast?${weatherParams.toString()}`);
      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        realWeatherScore = typeof weatherData.overallScore === "number"
          ? weatherData.overallScore
          : null;
      }
    } catch (err) {
      console.warn("[FlightSight] Weather fetch failed, using heuristic.", err);
    }

    const mapped = predictedFlights.map((p, i) => adaptPredictFlight(p, i, realWeatherScore));
    flights.length = 0;
    mapped.forEach((f) => flights.push(f));
  } catch (err) {
    console.warn("[FlightSight] Live flight fetch failed. Using fallback list.", err);
  }
}

const state = {
  view: "filters",
  maxPrice: 1000,
  stopsAllowed: new Set([0, 1, 2, 3]),
  minSafety: 0,
  sortBy: "price_asc",
  compare: []
};

function renderStats(list) {
  if (!list.length) {
    $("avgPrice").textContent = "—";
    $("lowPrice").textContent = "—";
    $("bestSafety").textContent = "—";
    $("lowCo2").textContent = "—";
    $("flightCountPill").textContent = "0 flights";
    return;
  }

  const avg = Math.round(list.reduce((a, f) => a + f.price, 0) / list.length);
  const low = Math.min(...list.map((f) => f.price));
  const bestSafety = Math.max(...list.map((f) => f.safety));
  const lowCo2 = Math.min(...list.map((f) => f.co2));

  $("avgPrice").textContent = `$${avg}`;
  $("lowPrice").textContent = `$${low}`;
  $("bestSafety").textContent = `${bestSafety}%`;
  $("lowCo2").textContent = `${lowCo2} kg`;
  $("flightCountPill").textContent = `${list.length} flights`;
}

function applyFilters(data) {
  let out = [...data];

  out = out.filter((f) => f.price <= state.maxPrice);
  out = out.filter((f) => f.safety >= state.minSafety);
  out = out.filter((f) => state.stopsAllowed.has(f.stops));

  switch (state.sortBy) {
    case "price_asc":
      out.sort((a, b) => a.price - b.price);
      break;
    case "safety_desc":
      out.sort((a, b) => b.safety - a.safety);
      break;
    case "co2_asc":
      out.sort((a, b) => a.co2 - b.co2);
      break;
    case "duration_asc":
      out.sort((a, b) => durationToMinutes(a.duration) - durationToMinutes(b.duration));
      break;
  }

  return out;
}

function syncFilterUI() {
  $("priceRange").value = String(state.maxPrice);
  $("priceRangeLabel").textContent = `$0 – $${state.maxPrice}`;

  $("minSafety").value = String(state.minSafety);
  $("minSafetyLabel").textContent = `${state.minSafety}%`;

  $("stops0").checked = state.stopsAllowed.has(0);
  $("stops1").checked = state.stopsAllowed.has(1);
  $("stops2").checked = state.stopsAllowed.has(2);
  $("stops3").checked = state.stopsAllowed.has(3);

  $("sortBy").value = state.sortBy;
}

function selectFlight(flightId) {
  const flight = flights.find((f) => f.id === flightId);
  if (!flight) return;

  // Store the complete flight object with all UI metrics
  const payload = flight._predictShape ? {
    ...flight._predictShape,
    // Add UI metrics that API doesn't provide
    safety: flight.safety,
    co2: flight.co2,
    weather: flight.weather,
    seats: flight.seats,
    score: flight.score,
    price: flight.price,
    depart: flight.depart,
    arrive: flight.arrive,
    duration: flight.duration,
    stops: flight.stops,
    airline: flight.airline,
    aircraft: flight.aircraft,
    flight: flight.flight
  } : flight;
  
  console.log("[FlightSight] SELECTING FLIGHT from flightResults.js:", payload);
  localStorage.setItem("selectedFlight", JSON.stringify(payload))
  localStorage.setItem("bookingReferrer", "flightResults.html");;
  window.location.href = "Booking.html";
}

function formatSeatAvailability(seatAvail) {
  const map = {
    "High availability": "High",
    "Moderate availability": "Moderate", 
    "Low availability": "Low",
    "Very limited": "Very Limited"
  };
  return map[seatAvail] || seatAvail || "Unknown";
}

function badgeClassForSeats(seatAvail) {
  if (seatAvail === "High availability") return "green";
  if (seatAvail === "Moderate availability") return "blue";
  if (seatAvail === "Low availability") return "amber";
  if (seatAvail === "Very limited") return "red";
  return "blue";
}

function flightCardHTML(f, includeOppCallout = false, cheapestPrice = null) {
  const stopText = f.stops === 0 ? "Nonstop" : f.stops === 1 ? "1 stop" : f.stops === 2 ? "2 stops" : "3 stops";

  const oppText = (() => {
    if (!includeOppCallout || cheapestPrice == null) return "";
    const delta = f.price - cheapestPrice;
    const sign = delta >= 0 ? "costs" : "saves";
    const amount = `$${Math.abs(delta)}`;

    return `
      <div class="opp-callout">
        <strong>Opportunity Cost</strong><br />
        Choosing this flight over the cheapest option ${sign} ${amount} more.
        You gain <b>${Math.max(0, f.safety - 70)}%</b> better safety and save
        <b>${Math.max(0, 300 - f.co2)} kg</b> CO₂.
      </div>
    `;
  })();

  return `
    <div class="flight-card" data-id="${safe(f.id)}">
      <div>
        <div class="flight-head">
          <strong>${safe(f.airline)}</strong>
          <div class="muted flight-sub">${safe(f.flight)} • ${safe(f.aircraft)}</div>
        </div>

        <div class="meta-row">
          <div class="meta-block">
            <div class="k">Departure</div>
            <div class="v">${safe(f.depart)}</div>
            <div class="s">${safe(f.departCode)}</div>
          </div>
          <div class="meta-block">
            <div class="k">Duration</div>
            <div class="v">${safe(f.duration)}</div>
            <div class="s">${safe(stopText)}</div>
          </div>
          <div class="meta-block">
            <div class="k">Arrival</div>
            <div class="v">${safe(f.arrive)}</div>
            <div class="s">${safe(f.arriveCode)}</div>
          </div>
        </div>

        <div class="badges">
          <div class="badge ${badgeClassForPct(f.safety)}">
            <div class="l">Safety</div>
            <div class="v">${safe(f.safety)}%</div>
          </div>
          <div class="badge ${badgeClassForCo2(f.co2)}">
            <div class="l">CO₂</div>
            <div class="v">${safe(f.co2)} kg</div>
          </div>
          <div class="badge blue">
            <div class="l">Weather</div>
            <div class="v">${safe(f.weather)}%</div>
          </div>
          <div class="badge ${badgeClassForSeats(f.seats)}">
            <div class="l">Seats</div>
            <div class="v">${safe(formatSeatAvailability(f.seats))}</div>
          </div>
          <div class="badge purple">
            <div class="l">Score</div>
            <div class="v">${safe(f.score)}</div>
          </div>
        </div>

        ${oppText}
      </div>

      <div class="right-col">
        <div class="price">$${safe(f.price)}<small>per person</small></div>
        <button class="select-btn" type="button" onclick="selectFlight('${safe(f.id)}')">
          Select Flight →
        </button>
      </div>
    </div>
  `;
}

function renderList() {
  const filtered = applyFilters(flights);
  renderStats(filtered);
  $("flightList").innerHTML = filtered.map((f) => flightCardHTML(f)).join("");
}

function renderRecommendation() {
  const filtered = applyFilters(flights).sort((a, b) => b.score - a.score);
  renderStats(filtered);
  $("flightList").innerHTML = filtered.map((f) => flightCardHTML(f)).join("");
}

let mapAnimationId = null;

function renderMapView() {
  const filtered = applyFilters(flights);
  renderStats(filtered);

  const origin = getAirportInfo(originName, filtered[0]?.departCode || "ORG");
  const destination = getAirportInfo(destinationName, filtered[0]?.arriveCode || "DST");

  const distance = haversineKm(origin.lat, origin.lon, destination.lat, destination.lon);
  const flightTime = estimateFlightTime(distance);
  const direction = getDirection(origin, destination);

  $("mapOriginName").textContent = origin.city;
  $("mapOriginCode").textContent = `${origin.code} · ${origin.country}`;
  $("mapOriginCoords").textContent = formatCoords(origin.lat, origin.lon);

  $("mapDestinationName").textContent = destination.city;
  $("mapDestinationCode").textContent = `${destination.code} · ${destination.country}`;
  $("mapDestinationCoords").textContent = formatCoords(destination.lat, destination.lon);

  $("mapDistance").textContent = `${distance} km`;
  $("mapFlightTime").textContent = flightTime;
  $("mapDirection").textContent = direction;

  $("routeNoteOrigin").textContent = origin.city;
  $("routeNoteDestination").textContent = destination.city;

  const routeCurve = document.getElementById("routeCurve");
  const routeDot = document.getElementById("routePlaneDot");
  const originMarker = document.getElementById("originMarker");
  const originPulse = document.getElementById("originPulse");
  const destinationMarker = document.getElementById("destinationMarker");
  const destinationPulse = document.getElementById("destinationPulse");
  const originLabel = document.getElementById("originLabel");
  const destinationLabel = document.getElementById("destinationLabel");
  const originCenterDot = document.querySelector("#originMarkerGroup circle:nth-of-type(3)");
  const destinationCenterDot = document.querySelector("#destinationMarkerGroup circle:nth-of-type(3)");

  if (
    !routeCurve || !routeDot || !originMarker || !originPulse ||
    !destinationMarker || !destinationPulse || !originLabel ||
    !destinationLabel || !originCenterDot || !destinationCenterDot
  ) {
    return;
  }

  const viewWidth = 900;
  const viewHeight = 430;
  const padX = 90;
  const padY = 60;

  function projectPoint(lat, lon) {
    const x = padX + ((lon + 180) / 360) * (viewWidth - padX * 2);
    const y = padY + ((90 - lat) / 180) * (viewHeight - padY * 2);
    return { x, y };
  }

  let p1 = projectPoint(origin.lat, origin.lon);
  let p2 = projectPoint(destination.lat, destination.lon);

  p1.x = Math.max(120, Math.min(viewWidth - 120, p1.x));
  p2.x = Math.max(120, Math.min(viewWidth - 120, p2.x));
  p1.y = Math.max(95, Math.min(viewHeight - 95, p1.y));
  p2.y = Math.max(95, Math.min(viewHeight - 95, p2.y));

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const isClose = Math.abs(dx) < 110 && Math.abs(dy) < 70;

  const cx = (p1.x + p2.x) / 2;
  let cy = Math.min(p1.y, p2.y) - (isClose ? 65 : 38) - Math.abs(dx) * 0.04;
  cy = Math.max(55, cy);

  const pathD = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`;
  routeCurve.setAttribute("d", pathD);

  originMarker.setAttribute("cx", p1.x);
  originMarker.setAttribute("cy", p1.y);
  originPulse.setAttribute("cx", p1.x);
  originPulse.setAttribute("cy", p1.y);
  originCenterDot.setAttribute("cx", p1.x);
  originCenterDot.setAttribute("cy", p1.y);

  destinationMarker.setAttribute("cx", p2.x);
  destinationMarker.setAttribute("cy", p2.y);
  destinationPulse.setAttribute("cx", p2.x);
  destinationPulse.setAttribute("cy", p2.y);
  destinationCenterDot.setAttribute("cx", p2.x);
  destinationCenterDot.setAttribute("cy", p2.y);

  if (isClose) {
    originLabel.setAttribute("x", p1.x + 10);
    originLabel.setAttribute("y", p1.y - 18);

    destinationLabel.setAttribute("x", p2.x - 52);
    destinationLabel.setAttribute("y", p2.y - 18);
  } else {
    originLabel.setAttribute("x", p1.x - 46);
    originLabel.setAttribute("y", p1.y - 20);

    destinationLabel.setAttribute("x", p2.x - 36);
    destinationLabel.setAttribute("y", p2.y - 20);
  }

  originLabel.textContent = `${origin.city} (${origin.code})`;
  destinationLabel.textContent = `${destination.city} (${destination.code})`;

  if (mapAnimationId) cancelAnimationFrame(mapAnimationId);

  const pathLength = routeCurve.getTotalLength();
  let progress = 0;

  function animateDot() {
    progress += Math.max(1.2, pathLength / 220);
    if (progress > pathLength) progress = 0;

    const point = routeCurve.getPointAtLength(progress);
    routeDot.setAttribute("cx", point.x);
    routeDot.setAttribute("cy", point.y);

    mapAnimationId = requestAnimationFrame(animateDot);
  }

  animateDot();
}

function renderOppAvailableRows(filtered) {
  $("availableOppList").innerHTML = filtered.map((f) => {
    return `
      <div class="row" data-row="${safe(f.id)}">
        <div>
          <div><b>${safe(f.airline)}</b></div>
          <div class="tiny">${safe(f.flight)} • ${safe(f.depart)} – ${safe(f.arrive)}</div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <div class="tiny"><b style="color:var(--blue)">$${safe(f.price)}</b></div>
          <button class="add" type="button" data-add="${safe(f.id)}">+ Compare</button>
        </div>
      </div>
    `;
  }).join("");

  $("availableOppList").querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.add;
      if (state.compare.includes(id)) return;
      if (state.compare.length >= 3) return;
      state.compare.push(id);
      renderOpp();
    });
  });
}

function renderCompareCards(filtered) {
  const slots = Array.from($("compareCards").querySelectorAll(".compare-card"));

  slots.forEach((slotEl, i) => {
    const id = state.compare[i];
    const f = filtered.find((x) => x.id === id);

    if (!f) {
      slotEl.classList.add("empty");
      slotEl.innerHTML = `
        <div class="x hidden" aria-hidden="true">×</div>
        <div class="plus">+</div>
        <div class="muted">Select a flight to compare</div>
      `;
      return;
    }

    slotEl.classList.remove("empty");
    slotEl.innerHTML = `
      <div class="x" data-remove="${safe(f.id)}" title="Remove">×</div>
      <div class="compare-mini-title">${safe(f.airline)}</div>
      <div class="compare-mini-sub">${safe(f.flight)}</div>

      <div class="compare-mini-grid">
        <div>Price</div><div><b>$${safe(f.price)}</b></div>
        <div>Duration</div><div><b>${safe(f.duration)}</b></div>
        <div>Stops</div><div><b>${f.stops === 0 ? "Nonstop" : f.stops === 1 ? "1 stop" : f.stops === 2 ? "2 stops" : "3 stops"}</b></div>
      </div>
    `;
  });

  $("compareCards").querySelectorAll("[data-remove]").forEach((x) => {
    x.addEventListener("click", () => {
      const id = x.dataset.remove;
      state.compare = state.compare.filter((v) => v !== id);
      renderOpp();
    });
  });
}

function bestOf(values, mode) {
  if (!values.length) return null;
  return mode === "min" ? Math.min(...values) : Math.max(...values);
}

function renderComparisonTable(filtered) {
  const chosen = state.compare.map((id) => filtered.find((f) => f.id === id)).filter(Boolean);

  if (!chosen.length) {
    $("compareTableWrap").innerHTML = "";
    return;
  }

  const prices = chosen.map((f) => f.price);
  const safeties = chosen.map((f) => f.safety);
  const co2s = chosen.map((f) => f.co2);
  const durations = chosen.map((f) => durationToMinutes(f.duration));

  const bestPrice = bestOf(prices, "min");
  const bestSafety = bestOf(safeties, "max");
  const bestCo2 = bestOf(co2s, "min");
  const bestDur = bestOf(durations, "min");

  function cell(val, isBest) {
    return `${safe(val)}${isBest ? `<span class="best-tag">Best</span>` : ""}`;
  }

  const cols = [0, 1, 2].map((i) => chosen[i]).filter(Boolean);

  const header = `
    <div class="compare-table">
      <div class="thead">
        <div>Category</div>
        ${cols.map((f) => `<div>${safe(f.airline)}</div>`).join("")}
        ${cols.length < 3 ? `<div style="display:${cols.length === 2 ? "block" : "none"}"></div>` : ""}
      </div>
  `;

  const rows = [
    ["Price", ...cols.map((f) => cell(`$${f.price}`, f.price === bestPrice))],
    ["Safety Rating", ...cols.map((f) => cell(`${f.safety}%`, f.safety === bestSafety))],
    ["CO₂ Emissions", ...cols.map((f) => cell(`${f.co2} kg`, f.co2 === bestCo2))],
    ["Duration", ...cols.map((f) => cell(`${f.duration}`, durationToMinutes(f.duration) === bestDur))],
    ["Stops", ...cols.map((f) => `${f.stops === 0 ? "Nonstop" : f.stops === 1 ? "1 stop" : f.stops === 2 ? "2 stops" : "3 stops"}`)],
    ["Aircraft", ...cols.map((f) => f.aircraft)],
    ["Departure", ...cols.map((f) => f.depart)],
    ["Arrival", ...cols.map((f) => f.arrive)],
    ["Weather Score", ...cols.map((f) => `${f.weather}%`)],
    ["Seat Availability", ...cols.map((f) => formatSeatAvailability(f.seats))]
  ];

  const body = rows.map((r) => {
    const [cat, ...vals] = r;
    return `
      <div class="trow">
        <div><b>${safe(cat)}</b></div>
        ${vals.map((v) => `<div>${v}</div>`).join("")}
        ${vals.length < 3 ? `<div style="display:${vals.length === 2 ? "block" : "none"}"></div>` : ""}
      </div>
    `;
  }).join("");

  $("compareTableWrap").innerHTML = header + body + `</div>`;
}

function renderOppCards(filtered) {
  const cheapest = filtered.length ? Math.min(...filtered.map((f) => f.price)) : null;
  $("oppCards").innerHTML = filtered.map((f) => flightCardHTML(f, true, cheapest)).join("");
}

function renderOpp() {
  const filtered = applyFilters(flights);
  renderStats(filtered);
  renderOppAvailableRows(filtered);
  renderCompareCards(filtered);
  renderComparisonTable(filtered);
  renderOppCards(filtered);
}

function setView(view) {
  state.view = view;

  document.querySelectorAll(".tab").forEach((btn) => {
    const is = btn.dataset.view === view;
    btn.classList.toggle("active", is);
    btn.setAttribute("aria-selected", is ? "true" : "false");
  });

  $("mapPanel").classList.toggle("hidden", view !== "map");
  $("oppPanel").classList.toggle("hidden", view !== "opp");
  $("listPanel").classList.toggle("hidden", !(view === "filters" || view === "rec"));
  $("filterbar").classList.toggle("hidden", !(view === "filters" || view === "map"));

  rerender();
}

function rerender() {
  const filtered = applyFilters(flights);
  $("flightCountPill").textContent = `${filtered.length} flights`;

  if (state.view === "filters") renderList();
  if (state.view === "rec") renderRecommendation();
  if (state.view === "opp") renderOpp();
  if (state.view === "map") renderMapView();
}

$("priceRange").addEventListener("input", (e) => {
  state.maxPrice = Number(e.target.value);
  $("priceRangeLabel").textContent = `$0 – $${state.maxPrice}`;
  rerender();
});

$("minSafety").addEventListener("input", (e) => {
  state.minSafety = Number(e.target.value);
  $("minSafetyLabel").textContent = `${state.minSafety}%`;
  rerender();
});

function stopsChanged() {
  state.stopsAllowed = new Set();
  if ($("stops0").checked) state.stopsAllowed.add(0);
  if ($("stops1").checked) state.stopsAllowed.add(1);
  if ($("stops2").checked) state.stopsAllowed.add(2);
  if ($("stops3").checked) state.stopsAllowed.add(3);
  rerender();
}

$("stops0").addEventListener("change", stopsChanged);
$("stops1").addEventListener("change", stopsChanged);
$("stops2").addEventListener("change", stopsChanged);
$("stops3").addEventListener("change", stopsChanged);

$("sortBy").addEventListener("change", (e) => {
  state.sortBy = e.target.value;
  rerender();
});

$("clearFiltersBtn").addEventListener("click", () => {
  state.maxPrice = 1000;
  state.minSafety = 0;
  state.stopsAllowed = new Set([0, 1, 2, 3]);
  state.sortBy = "price_asc";
  syncFilterUI();
  rerender();
});

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});

$("flightSightBtn").addEventListener("click", () => {
  window.location.href = "homePage.html";
});

async function initResultsPage() {
  await loadLiveFlights();
  syncFilterUI();
  setView("filters");
}

initResultsPage();
