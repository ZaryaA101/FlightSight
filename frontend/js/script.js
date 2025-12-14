document.addEventListener("DOMContentLoaded", () => {
  /*   GLOBAL NAVIGATION (from script.js) */
  const searchBtn = document.querySelector(".search-btn");
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      window.location.href = "flightRoute.html";
    });
  }

  /* ================= LOGIN PAGE LOGIC ================= */
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const messageBox = document.getElementById("message");

    function showLoginMessage(text, type = "error") {
      if (!messageBox) return;
      messageBox.textContent = text;
      messageBox.classList.remove("error", "success");
      if (text) {
        messageBox.classList.add(type);
      }
    }

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      showLoginMessage("");

      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      if (!email || !password) {
        showLoginMessage("Please enter both email and password.");
        return;
      }

      try {
        const response = await fetch("/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          showLoginMessage(data.error || "Login failed.");
          return;
        }

        showLoginMessage("Login successful. Redirecting…", "success");

        setTimeout(() => {
          // change this if your main page has a different name
          window.location.href = "homePage.html";
        }, 600);
      } catch (err) {
        console.error("Login error:", err);
        showLoginMessage("Something went wrong. Please try again.");
      }
    });
  }

  /* ================= SIGHUP PAGE LOGIC ================= */
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    const firstNameInput = document.getElementById("firstName");
    const lastNameInput = document.getElementById("lastName");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const messageBox = document.getElementById("message");

    function showSignupMessage(text, type = "error") {
      if (!messageBox) return;
      messageBox.textContent = text;
      messageBox.classList.remove("error", "success");
      if (text) {
        messageBox.classList.add(type);
      }
    }

    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      showSignupMessage("");

      const first_name = firstNameInput.value.trim();
      const last_name = lastNameInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      const confirmPassword = confirmPasswordInput.value.trim();

      if (!first_name || !last_name || !email || !password || !confirmPassword) {
        showSignupMessage("Please fill out all fields.");
        return;
      }

      if (password !== confirmPassword) {
        showSignupMessage("Passwords do not match.");
        return;
      }

      try {
        const response = await fetch("/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ first_name, last_name, email, password }),
        });

        let data;
        try {
          data = await response.json();
        } catch (err) {
          console.error("Could not parse JSON from /auth/signup", err);
          showSignupMessage("Unexpected server response.");
          return;
        }

        if (!response.ok) {
          showSignupMessage(data.error || "Sign up failed.");
          return;
        }

        showSignupMessage("Account created! Redirecting to sign in…", "success");

        setTimeout(() => {
          window.location.href = "login.html";
        }, 900);
      } catch (err) {
        console.error("Signup error:", err);
        showSignupMessage("Something went wrong. Please try again.");
      }
    });
  }

  /* ================= FLIGHT ROUTE PAGE LOGIC ================= */
  const continueBtn = document.querySelector(".continue-btn");
  const airportElements = document.querySelectorAll("#airportList li");

  if (airportElements.length) {

    const airports = Array.from(airportElements).map(li => ({
      code: li.dataset.code,
      name: li.textContent
    }));

    let selectedOrigin = null;
    let selectedDestination = null;

    function setupAutocomplete(inputId, suggestionId, onSelect) {
      const input = document.getElementById(inputId);
      const suggestions = document.getElementById(suggestionId);

      input.addEventListener("input", () => {
        const value = input.value.toLowerCase();
        suggestions.innerHTML = "";

        if (!value) {
          suggestions.style.display = "none";
          return;
        }

        const matches = airports.filter(a =>
          a.name.toLowerCase().includes(value) ||
          a.code.toLowerCase().includes(value)
        );

        matches.forEach(airport => {
          const li = document.createElement("li");
          li.textContent = airport.name;
          li.addEventListener("click", () => {
            input.value = airport.name;
            suggestions.style.display = "none";
            onSelect(airport);
          });
          suggestions.appendChild(li);
        });

        suggestions.style.display = matches.length ? "block" : "none";
      });

      document.addEventListener("click", e => {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
          suggestions.style.display = "none";
        }
      });
    }

    setupAutocomplete("origin", "originSuggestions", airport => {
      selectedOrigin = airport;
    });

    setupAutocomplete("destination", "destinationSuggestions", airport => {
      selectedDestination = airport;
    });

    if (continueBtn) {
      continueBtn.addEventListener("click", () => {
        if (!selectedOrigin || !selectedDestination) {
          alert("Please select both origin and destination.");
          return;
        }

        localStorage.setItem("origin", JSON.stringify(selectedOrigin));
        localStorage.setItem("destination", JSON.stringify(selectedDestination));

        window.location.href = "calendar.html";
      });
    }
  }

  /* ================= CALENDAR PAGE LOGIC ================= */
  const dateInput = document.getElementById("dateRange");
  const roundTripBtn = document.getElementById("roundTrip");
  const oneWayBtn = document.getElementById("oneWay");
  const searchFlightBtn = document.getElementById("searchFlights");
  const routeDisplay = document.getElementById("selectedRoute");

  let tripType = "round"; // default

  // ===== LOAD ROUTE FROM STORAGE =====
  const from = localStorage.getItem("fromAirport");
  const to = localStorage.getItem("toAirport");

  if (from && to && routeDisplay) {
    routeDisplay.value = `${from} → ${to}`;
  }

  // ===== FLATPICKR INIT =====
  // Target the new container div instead of input
  const calendarContainer = document.getElementById("calendarContainer");

  const fp = flatpickr(calendarContainer, {
    mode: "range",
    minDate: "today",
    dateFormat: "M d, Y",
    inline: true,        // always show calendar
    allowInput: false,   // disable typing
    showMonths: window.innerWidth < 768 ? 1 : 2,     // show two months side by side

    onChange(selectedDates) {
      if (tripType === "one" && selectedDates.length >= 1) {
        localStorage.setItem("departureDate", selectedDates[0].toISOString());
        localStorage.removeItem("returnDate");
      }

      if (tripType === "round" && selectedDates.length === 2) {
        localStorage.setItem("departureDate", selectedDates[0].toISOString());
        localStorage.setItem("returnDate", selectedDates[1].toISOString());
      }

      updateSearchButton();
    }
  });

  // ===== TRIP TYPE TOGGLE =====
  roundTripBtn?.addEventListener("click", () => {
    tripType = "round";
    roundTripBtn.classList.add("active");
    oneWayBtn.classList.remove("active");

    fp.set("mode", "range");
    fp.clear();

    localStorage.removeItem("departureDate");
    localStorage.removeItem("returnDate");

    updateSearchButton();
  });

  oneWayBtn?.addEventListener("click", () => {
    tripType = "one";
    oneWayBtn.classList.add("active");
    roundTripBtn.classList.remove("active");

    fp.set("mode", "single");
    fp.clear();

    localStorage.removeItem("departureDate");
    localStorage.removeItem("returnDate");

    updateSearchButton();
  });

  // ===== SEARCH BUTTON LOGIC =====
  searchBtn?.addEventListener("click", () => {
    const depart = localStorage.getItem("departureDate");
    const ret = localStorage.getItem("returnDate");

    if (!depart) {
      alert("Please select a departure date.");
      return;
    }

    if (tripType === "round" && !ret) {
      alert("Please select a return date.");
      return;
    }

    // Navigate to flights page
    window.location.href = "flights.html";
  });

  // ===== ENABLE / DISABLE SEARCH BUTTON =====
  function updateSearchButton() {
    const depart = localStorage.getItem("departureDate");
    const ret = localStorage.getItem("returnDate");

    if (
      (tripType === "one" && depart) ||
      (tripType === "round" && depart && ret)
    ) {
      searchBtn.disabled = false;
      searchBtn.classList.remove("disabled");
    } else {
      searchBtn.disabled = true;
      searchBtn.classList.add("disabled");
    }
  }

});
