require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const accountRoutes = require("./routes/account");

const app = express();
app.use(express.json());
app.use(helmet());

// Rate limiting (auth/account routes)
// In E2E, allow isolating buckets via a custom header so tests don't interfere
const keyGenerator = (req) => {
  if (process.env.NODE_ENV === "e2e") {
    const hdr = req.get("x-e2e-key");
    if (hdr) return hdr;
  }
  return req.ip;
};

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, keyGenerator });
// Only rate-limit login/register. Do NOT limit /auth/me to avoid masking auth errors.
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

const accountLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, keyGenerator });
app.use("/api/account", accountLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 8080;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`API listening on :${PORT}`));
  } catch (e) {
    console.error("Failed to start API", e);
    process.exit(1);
  }
}
// Only auto-start when not under test
if (process.env.NODE_ENV !== "test") {
  start();
}

module.exports = app;
