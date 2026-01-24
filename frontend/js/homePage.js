document.addEventListener("DOMContentLoaded", () => {
  /* ================= GLOBAL NAVIGATION ================= */
  const searchBtn = document.querySelector(".search-btn");
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      window.location.href = "flightRoute.html";
    });
  }
});