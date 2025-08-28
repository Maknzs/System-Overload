// src/api.js
// Prefer env-configured API base for flexibility; fallback to same-origin /api
const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || "/api";

export async function api(path, { method = "GET", body, headers } = {}) {
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
  if (!res.ok) {
    const snippet = typeof data.message === "string" ? data.message.slice(0, 200) : "";
    const baseMsg = (data.error && data.error.message) || (typeof data.message === "string" ? snippet : null) || `HTTP ${res.status}`;
    const hint = ct && !ct.includes("application/json") ? ` (non-JSON response: ${ct})` : "";
    throw new Error(`${baseMsg}${hint} (${method} ${url})`);
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
