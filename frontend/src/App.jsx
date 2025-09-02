// frontend/src/App.jsx
import { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Menu from "./pages/Menu.jsx";
import Lobby from "./pages/Lobby.jsx";
import Game from "./pages/Game.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import { api } from "./api"; // fetch helper (now includes credentials for cookies)

export default function App() {
  const nav = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const authed = Boolean(token);

  // keep api helper aware of token, if your helper needs it
  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  // (Removed auto-clear on /login; 401 handler already clears tokens.)

  // Quickly reject obviously bad or expired tokens without waiting for /auth/me
  useEffect(() => {
    if (!token) return;
    const parts = String(token).split(".");
    // Only pre-validate if token looks like a JWT; otherwise defer to /auth/me
    if (parts.length !== 3) return;
    try {
      // Base64URL decode
      const b64 = (s) => s.replace(/-/g, "+").replace(/_/g, "/");
      const json = atob(b64(parts[1]));
      const payload = JSON.parse(json || "{}");
      const expMs = typeof payload.exp === "number" ? payload.exp * 1000 : null;
      if (!expMs || expMs < Date.now()) throw new Error("expired");
      // Looks fine; let /auth/me validate server-side
    } catch (_) {
      try { localStorage.removeItem("token"); } catch {}
      setToken("");
      setUser(null);
      nav("/login");
    }
  }, [token, nav]);

  // Try Better Auth session first; fall back to legacy /auth/me if needed
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!token) {
        setUser(null);
        return;
      }
      try {
        const sess = await api("/better-auth/session");
        if (ignore) return;
        // Accept common shapes: { user }, or { session: { user } }
        const u = (sess && (sess.user || (sess.session && sess.session.user))) || null;
        if (u) {
          // Map Better Auth fields to our UI expectations where possible
          setUser({
            email: u.email,
            username: u.name || (user && user.username) || undefined,
            gamesPlayed: user && user.gamesPlayed, // keep prior value if any
          });
          return;
        }
      } catch (_) {
        // Ignore and try legacy endpoint next
      }
      try {
        const me = await api("/auth/me");
        if (!ignore) setUser(me);
      } catch (e) {
        if (!ignore) {
          const msg = String(e && e.message ? e.message : "");
          const authError = /HTTP\s*401/.test(msg) || /Invalid or expired token/i.test(msg);
          if (authError) {
            try { localStorage.removeItem("token"); } catch {}
            setToken("");
            setUser(null);
            nav("/login");
          } else {
            setUser((u) => u || null);
          }
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [token, nav]);

  const handleLogin = useCallback(
    (t, u) => {
      setToken(t);
      setUser(u);
      nav("/"); // land in lobby (root) after login
    },
    [nav]
  );

  const handleLogout = useCallback(async () => {
    try {
      // Prefer Better Auth sign-out (clears session cookies)
      await api("/better-auth/sign-out", { method: "POST" });
    } catch (_) {
      // Ignore errors; fall through to local cleanup
    }
    setToken("");
    setUser(null);
    nav("/login");
  }, [nav]);

  return (
    <Routes>
      {/* Root is the Lobby (public) */}
      <Route
        path="/"
        element={
          <Lobby
            authed={authed}
            user={user}
            onStart={(players) => {
              const names = players.map((p) => p.name);
              nav("/game", { state: { names } });
            }}
            onBack={() => nav("/profile")}
          />
        }
      />

      {/* Profile (formerly at "/"): protected */}
      <Route
        path="/profile"
        element={
          authed ? (
            user ? (
              <Menu
                user={user}
                onStart={() => nav("/")}
                onLogout={handleLogout}
                onUserUpdate={setUser}
              />
            ) : (
              <div style={{ padding: 16 }}>Loading…</div>
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      {/* Back-compat: send old /lobby to root */}
      <Route path="/lobby" element={<Navigate to="/" replace />} />
      <Route
        path="/game"
        element={<Game />}
      />
      <Route
        path="/login"
        element={
          authed ? (
            <Navigate to="/" replace />
          ) : (
            <Login
              onLogin={handleLogin}
              goRegister={() => nav("/register")}
              goBack={() => nav("/")}
            />
          )
        }
      />
      <Route
        path="/register"
        element={
          authed ? (
            <Navigate to="/" replace />
          ) : (
            <Register
              goLogin={() => nav("/login")}
              onRegistered={() => nav("/")}
            />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
