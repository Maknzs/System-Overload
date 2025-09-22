// Centralized environment/phase flags for the API
//
// APP_PHASE allows decoupling business rollout phases (development, staging, production)
// from Node's NODE_ENV which tools often use (development, test, production, e2e).

const NODE_ENV = process.env.NODE_ENV || "development";
const APP_PHASE = (process.env.APP_PHASE || "").trim().toLowerCase() ||
  // Fallback: map NODE_ENV to an app phase if APP_PHASE is not set
  (NODE_ENV === "production" ? "production" : "development");

const IS_TEST = NODE_ENV === "test";
const IS_E2E = NODE_ENV === "e2e";
const IS_DEV_TOOLS = APP_PHASE === "development" || NODE_ENV === "development";

module.exports = {
  NODE_ENV,
  APP_PHASE,
  IS_TEST,
  IS_E2E,
  IS_DEV_TOOLS,
};

