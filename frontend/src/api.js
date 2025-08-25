// src/api.js
const BASE = "/api"; // nginx/caddy is proxying this to your backend

export async function api(path, { method = "GET", body, headers } = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

api.incrementGamesPlayed = () =>
  api("/account/games-played", { method: "POST" }); // matches the backend route you added
