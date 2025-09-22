// src/api.js
// Compute the API base URL.
// Priority:
// 1) Explicit env override `VITE_API_BASE`
// 2) When running Vite dev on :5173, default to backend on :8080 (bypass proxy)
// 3) Fallback to same-origin "/api"
let BASE = "/api";
try {
  const envBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || "";
  if (envBase) {
    BASE = envBase;
  } else if (typeof window !== 'undefined' && window.location && window.location.port === '5173') {
    // Common local dev setup in this repo
    BASE = "http://localhost:8080/api";
  }
} catch (_) {
  // ignore and keep default
}

// Supports options:
// - method, body, headers (as before)
// - okStatuses: number[] — HTTP status codes that should not throw
export async function api(path, { method = "GET", body, headers, okStatuses } = {}) {
  const token = localStorage.getItem("token");
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    // Include cookies for session-based auth; harmless for existing JWT flow
    credentials: 'include',
  });
  const text = await res.text();
  let data = {};
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (text) {
    if (ct.includes("application/json")) {
      try {
        data = JSON.parse(text);
      } catch (_) {
        // fallthrough to text handling below
        data = { message: text };
      }
    } else {
      data = { message: text };
    }
  }
  const okList = Array.isArray(okStatuses) ? okStatuses : [];
  if (!res.ok && !okList.includes(res.status)) {
    const snippet = typeof data.message === "string" ? data.message.slice(0, 200) : "";
    const baseMsg = (data.error && data.error.message) || (typeof data.message === "string" ? snippet : null) || `HTTP ${res.status}`;
    const hint = ct && !ct.includes("application/json") ? ` (non-JSON response: ${ct})` : "";
    const err = new Error(`${baseMsg}${hint} (${method} ${url})`);
    // Attach additional metadata for consumers to present better UX
    try {
      err.status = res.status;
      err.code = data && data.error && data.error.code ? data.error.code : undefined;
      err.method = method;
      err.url = url;
      err.contentType = ct;
      err.body = data;
      err.name = 'ApiError';
    } catch (_) {
      // Non-fatal if attaching metadata fails
    }
    throw err;
  }
  return data;
}

api.incrementGamesPlayed = () =>
  api("/account/games-played", { method: "POST" }); // matches the backend route you added

// Account management helpers
api.updateEmail = ({ newEmail, currentPassword }) =>
  api("/account/email", { method: "PUT", body: { newEmail, currentPassword } });

api.updateUsername = ({ newUsername, currentPassword }) =>
  api("/account/username", { method: "PUT", body: { newUsername, currentPassword } });

api.updatePassword = ({ currentPassword, newPassword }) =>
  api("/account/password", { method: "PUT", body: { currentPassword, newPassword } });

// Delete account
api.deleteAccount = () => api("/account", { method: "DELETE" });

// Feedback
api.submitFeedback = ({ email, message, players }) =>
  api("/feedback", { method: "POST", body: { email, message, players } });

// Auth helpers
api.logout = () => api("/auth/logout", { method: "POST" });
