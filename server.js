require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { neon } = require("@neondatabase/serverless");

const app = express();
const sql = neon(process.env.DATABASE_URL);

app.use(cors());
app.use(express.json());
app.use(express.static("frontend"));

// CRUD Operations:

// READ — Get all members
app.get("/members", async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM members ORDER BY id;`;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/members", async (req, res) => {
  const { name } = req.body;

  try {
    console.log("Incoming name:", name);   // <-- ADD THIS
    const row =
      await sql`INSERT INTO members (name) VALUES (${name}) RETURNING *;`;
    res.json(row[0]);
  } catch (err) {
    console.error("INSERT ERROR:", err);   // <-- ADD THIS
    res.status(500).json({ error: err.message });
  }
});

// UPDATE — Update member by ID
app.put("/members/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Name is required." });
  }

  try {
    const row =
      await sql`UPDATE members SET name = ${name} WHERE id = ${id} RETURNING *;`;
    res.json(row[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE — Delete member by ID
app.delete("/members/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await sql`DELETE FROM members WHERE id = ${id};`;
    res.json({ message: "Member deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(process.env.PORT, () =>
  console.log(`Server running on http://localhost:${process.env.PORT}`)
);

//ZARYA'S FEATURES

//Emissions
app.get("/emissions", (req, res) => {
  res.json({ airline: "Delta", co2: 180 });
});

//Seat + Weather
app.get("/seatweather", (req, res) => {
  res.json({ seat_status: "Available", weather: "Clear" });
});

//Recommendation System
app.get("/recommendation", (req, res) => {
  res.json({ best_airline: "United Airlines" });
});

//Dataset Analysis
app.get("/analysis", (req, res) => {
  res.json({
    avg_price: 320,
    cheapest_city: "Dallas",
    busiest_month: "July"
  });
});

//Heatmap Data
app.get("/heatmap", (req, res) => {
  res.json([
    { city: "LA", demand: 90 },
    { city: "NYC", demand: 75 },
    { city: "Chicago", demand: 60 }
  ]);
});
