const express = require("express");
const tweetRoutes = require("./routes/tweet.routes");

const app = express();

app.use(express.json());

app.use("/v1/tweets", tweetRoutes);

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

module.exports = app;
