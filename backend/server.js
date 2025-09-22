require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const { APP_PHASE, IS_E2E, IS_DEV_TOOLS, NODE_ENV } = require("./config");

const authRoutes = require("./routes/auth");
const accountRoutes = require("./routes/account");
const feedbackRoutes = require("./routes/feedback");
let betterAuth;
try {
  betterAuth = require("./auth/betterAuth");
} catch (_) {
  betterAuth = null;
}

const app = express();
app.use(express.json());
app.use(helmet());

// Rate limiting (auth/account routes)
// In E2E, allow isolating buckets via a custom header so tests don't interfere
const keyGenerator = (req) => {
  if (IS_E2E) {
    const hdr = req.get("x-e2e-key");
    if (hdr) return hdr;
  }
  return req.ip;
};
// Looser limits in development phase to avoid throttling local testers
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_DEV_TOOLS ? 1000 : 100,
  keyGenerator,
});
// Only rate-limit login/register. Do NOT limit /auth/me to avoid masking auth errors.
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_DEV_TOOLS ? 2000 : 200,
  keyGenerator,
});
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_DEV_TOOLS ? 2000 : 200,
  keyGenerator,
});
app.use("/api/account", accountLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/feedback", feedbackLimiter);
app.use("/api/feedback", feedbackRoutes);

// Mount Better Auth under /api/better-auth if available
if (betterAuth) {
  try {
    const { handler } = betterAuth.createBetterAuth();
    app.use("/api/better-auth", (req, res) => handler(req, res));
    console.log("Better Auth mounted at /api/better-auth");
  } catch (e) {
    console.warn(
      "Better Auth not initialized:",
      e && e.message ? e.message : e
    );
  }
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Development helper endpoint: returns minimal env flags (no secrets)
if (IS_DEV_TOOLS) {
  app.get("/api/dev/info", (_req, res) =>
    res.json({ ok: true, phase: APP_PHASE, nodeEnv: NODE_ENV })
  );
}

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
