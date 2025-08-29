// frontend/src/App.jsx
import { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Menu from "./pages/Menu.jsx";
import Lobby from "./pages/Lobby.jsx";
import Game from "./pages/Game.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import { api } from "./api"; // assumes you already have this helper

export default function App() {
  const nav = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(false);
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
      try {
        localStorage.removeItem("token");
      } catch {}
      setToken("");
      setUser(null);
      nav("/login");
    }
  }, [token, nav]);

  // try to fetch the current user with the token
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!token) {
        setUser(null);
        return;
      }
      try {
        const me = await api("/auth/me"); // your backend should return the user
        if (!ignore) setUser(me);
      } catch (e) {
        // Clear token only on auth errors (401 / BAD_TOKEN). Keep token on transient failures.
        if (!ignore) {
          const msg = String(e && e.message ? e.message : "");
          const authError =
            /HTTP\s*401/.test(msg) || /Invalid or expired token/i.test(msg);
          if (authError) {
            // Proactively clear storage to satisfy immediate checks in E2E
            try {
              localStorage.removeItem("token");
            } catch {}
            setToken("");
            setUser(null);
            // Ensure router navigates away from protected routes
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
      setGuest(false);
      nav("/"); // go to menu
    },
    [nav]
  );

  const handleGuest = useCallback(() => {
    setGuest(true);
    setToken("");
    setUser(null);
    nav("/lobby");
  }, [nav]);

  const handleLogout = useCallback(() => {
    setToken("");
    setUser(null);
    nav("/login");
  }, [nav]);

  // small wrappers so we can pass callbacks that navigate
  const MenuScreen = () => (
    <Menu user={user} onStart={() => nav("/lobby")} onLogout={handleLogout} />
  );

  const LobbyScreen = () => (
    <Lobby
      onStart={(players) => {
        // Pass full player objects, including isBot flags
        nav("/game", { state: { players } });
      }}
      onBack={() => nav("/")}
    />
  );

  const LoginScreen = () => (
    <Login
      onLogin={handleLogin}
      goRegister={() => nav("/register")}
      goGuest={handleGuest}
    />
  );

  const RegisterScreen = () => (
    <Register
      goLogin={() => nav("/login")}
      onRegistered={() => nav("/login")}
    />
  );

  return (
    <Routes>
      <Route
        path="/"
        element={
          authed ? (
            user ? (
              <Menu
                user={user}
                onStart={() => nav("/lobby")}
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
      <Route
        path="/lobby"
        element={
          authed || guest ? (
            <Lobby
              onStart={(players) => {
                // Preserve isBot flags and names so Game can identify bots
                nav("/game", { state: { players } });
              }}
              onBack={() => nav("/")}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/game"
        element={authed || guest ? <Game /> : <Navigate to="/login" replace />}
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
              goGuest={handleGuest}
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
              onRegistered={() => nav("/login")}
            />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
