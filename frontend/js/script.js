document.addEventListener("DOMContentLoaded", function() {
  const searchBtn = document.querySelector(".search-btn");
  if (searchBtn) {
    searchBtn.addEventListener("click", function() {
      window.location.href = "flightRoute.html";
    });
  }

  const continueBtn = document.querySelector(".continue-btn");
  if (continueBtn) {
    continueBtn.addEventListener("click", function() {
      window.location.href = "calendar.html";
    });
  }

  const selectDatesBtn = document.getElementById("selectDatesBtn");
  if (selectDatesBtn) {
    selectDatesBtn.addEventListener("click", function () {
      window.location.href = "Booking.html";
    });
  }
});
