const express = require("express");
const userRoutes = require("./routes/user.routes");

const app = express();

app.use(express.json());

app.use("/v1/users", userRoutes);

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

module.exports = app;
