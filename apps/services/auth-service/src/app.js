const express = require("express");
const authRoutes = require("./routes/authRoutes");

const app = express();

// Parse incoming JSON requests
app.use(express.json());

// Auth routes
app.use("/v1/auth", authRoutes);

// Health check
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

module.exports = app;
