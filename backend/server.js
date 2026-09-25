require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");

const app = express();

// --- Core middleware ---
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// --- Routes ---
app.use("/api/auth", require("./routes/authRoutes"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "buksupply-backend" });
});

// --- Start server after DB connects ---
const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`BukSUPPLY server running on port ${PORT}`);
  });
});