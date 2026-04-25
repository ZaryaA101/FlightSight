// ================= DATA MODEL =================
const bookingData = {
  airline: "Delta Airlines",

  departure: {
    code: "LAX",
    time: "8:30 AM",
  },

  arrival: {
    code: "JFK",
    time: "4:50 PM",
  },

  duration: "5h 20m",
  stops: "Non-stop",

  date: "July 15, 2026",
  day: "Tuesday",
  returnDate: null,
  returnDay: null,

  seatFill: 78,

  weather: {
    departure: { temp: "75°F", condition: "Sunny" },
    arrival: { temp: "68°F", condition: "Partly Cloudy" },
  },

  safety: 87,
  co2: "1,240 kg",
};

// ================= RENDER =================
function renderBooking(data) {
  const airlineNameEl = document.getElementById("airlineName");
  const departureCodeEl = document.getElementById("departureCode");
  const departureTimeEl = document.getElementById("departureTime");
  const arrivalCodeEl = document.getElementById("arrivalCode");
  const arrivalTimeEl = document.getElementById("arrivalTime");
  const durationEl = document.getElementById("duration");
  const stopsEl = document.getElementById("stops");
  const dateRangeEl = document.getElementById("dateRange");
  const dayRangeEl = document.getElementById("dayRange");
  const seatFillTextEl = document.getElementById("seatFillText");
  const seatFillBarEl = document.getElementById("seatFillBar");
  const depWeatherCodeEl = document.getElementById("depWeatherCode");
  const arrWeatherCodeEl = document.getElementById("arrWeatherCode");
  const depTempEl = document.getElementById("depTemp");
  const depConditionEl = document.getElementById("depCondition");
  const arrTempEl = document.getElementById("arrTemp");
  const arrConditionEl = document.getElementById("arrCondition");
  const safetyTextEl = document.getElementById("safetyText");
  const safetyBarEl = document.getElementById("safetyBar");
  const co2TextEl = document.getElementById("co2Text");

  if (airlineNameEl) airlineNameEl.textContent = data.airline;

  if (departureCodeEl) departureCodeEl.textContent = data.departure.code;
  if (departureTimeEl) departureTimeEl.textContent = data.departure.time;

  if (arrivalCodeEl) arrivalCodeEl.textContent = data.arrival.code;
  if (arrivalTimeEl) arrivalTimeEl.textContent = data.arrival.time;

  if (durationEl) durationEl.textContent = data.duration;
  if (stopsEl) stopsEl.textContent = data.stops;

  if (dateRangeEl) {
    if (data.returnDate) {
      dateRangeEl.textContent = `${data.date} → ${data.returnDate}`;
    } else {
      dateRangeEl.textContent = data.date;
    }
  }

  if (dayRangeEl) {
    if (data.returnDay) {
      dayRangeEl.textContent = `${data.day} → ${data.returnDay}`;
    } else {
      dayRangeEl.textContent = data.day;
    }
  }

  if (seatFillTextEl) seatFillTextEl.textContent = data.seatFill;
  if (seatFillBarEl) {
    seatFillBarEl.style.width = data.seatFill + "%";
    seatFillBarEl.dataset.target = data.seatFill;
  }

  if (depWeatherCodeEl) depWeatherCodeEl.textContent = data.departure.code;
  if (arrWeatherCodeEl) arrWeatherCodeEl.textContent = data.arrival.code;

  if (depTempEl) depTempEl.textContent = data.weather.departure.temp;
  if (depConditionEl) depConditionEl.textContent = data.weather.departure.condition;

  if (arrTempEl) arrTempEl.textContent = data.weather.arrival.temp;
  if (arrConditionEl) arrConditionEl.textContent = data.weather.arrival.condition;

  if (safetyTextEl) safetyTextEl.textContent = data.safety;
  if (safetyBarEl) {
    safetyBarEl.style.width = data.safety + "%";
    safetyBarEl.dataset.target = data.safety;
  }

  if (co2TextEl) co2TextEl.textContent = data.co2;
}

// ================= PRICE LOGIC =================
function formatUSD(n) {
  return "$" + n.toFixed(0);
}

function updatePrice(total, seatName) {
  const TAX_RATE = 0.06;
  const MIN_TAX = 20;

  const taxes = Math.max(MIN_TAX, Math.round(total * TAX_RATE));
  const base = total - taxes;

  const seatClassLabelEl = document.getElementById("seatClassLabel");
  const baseFareEl = document.getElementById("baseFare");
  const taxesFeesEl = document.getElementById("taxesFees");
  const totalPriceEl = document.getElementById("totalPrice");

  if (seatClassLabelEl) seatClassLabelEl.textContent = seatName;
  if (baseFareEl) baseFareEl.textContent = formatUSD(base);
  if (taxesFeesEl) taxesFeesEl.textContent = formatUSD(taxes);
  if (totalPriceEl) totalPriceEl.textContent = formatUSD(total);
}

// ================= ROUTE SYNC =================
function applyRoute() {
  const origin = JSON.parse(localStorage.getItem("origin") || "null");
  const destination = JSON.parse(localStorage.getItem("destination") || "null");

  if (!origin || !destination) {
    alert("Select route first.");
    window.location.href = "flightRoute.html";
    return false;
  }

  bookingData.departure.code = origin.code;
  bookingData.arrival.code = destination.code;
  return true;
}

// ================= DATE SYNC =================
function applyDates() {
  const departureDate = localStorage.getItem("departureDate");
  const returnDate = localStorage.getItem("returnDate");

  if (!departureDate) return;

  const depart = new Date(departureDate);

  bookingData.date = depart.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  bookingData.day = depart.toLocaleDateString("en-US", {
    weekday: "long",
  });

  if (returnDate) {
    const ret = new Date(returnDate);

    bookingData.returnDate = ret.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    bookingData.returnDay = ret.toLocaleDateString("en-US", {
      weekday: "long",
    });
  } else {
    bookingData.returnDate = null;
    bookingData.returnDay = null;
  }
}

// ================= AIRPORT METRICS =================
async function applyAirportMetrics() {
  const origin = JSON.parse(localStorage.getItem("origin") || "null");
  if (!origin || !origin.code) return;

  try {
    const response = await fetch("/data/airports_list.csv");
    console.log("CSV status:", response.status); // debug
    if (!response.ok) throw new Error("CSV not found");

    const csvText = await response.text();
    const rows = csvText.trim().split(/\r?\n/);

    if (rows.length < 2) return;

    const headers = rows[0].split(",").map((h) => h.trim());

    const airportIndex = headers.indexOf("airport");
    const safetyIndex = headers.indexOf("Safety_percentage");
    const co2Index = headers.indexOf("CO2_emissions_kg");

    if (airportIndex === -1 || safetyIndex === -1 || co2Index === -1) {
      console.log("Required CSV columns not found");
      return;
    }

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].split(",").map((c) => c.trim());

      if (cols[airportIndex] === origin.code) {
        bookingData.safety = Number(cols[safetyIndex]) || bookingData.safety;
        bookingData.co2 = `${Number(cols[co2Index]).toLocaleString()} kg`;
        break;
      }
    }
  } catch (error) {
    console.log("Could not load airport metrics:", error);
  }
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {
  const hasRoute = applyRoute();
  if (!hasRoute) return;

  applyDates();
  await applyAirportMetrics();
  renderBooking(bookingData);

  const buttons = document.querySelectorAll(".seat-option");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");

      const price = Number(btn.dataset.price);
      const seat = btn.dataset.seat;

      updatePrice(price, seat);
    });
  });

  updatePrice(320, "Economy");
});