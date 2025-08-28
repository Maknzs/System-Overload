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
      } catch {
        if (!ignore) {
          setToken("");
          setUser(null);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [token]);

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

  return (
    <Routes>
      <Route
        path="/"
        element={
          authed ? (
            <Menu
              user={user}
              onStart={() => nav("/lobby")}
              onLogout={handleLogout}
              onUserUpdate={setUser}
            />
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
                const names = players.map((p) => p.name);
                nav("/game", { state: { names } });
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
          <Login
            onLogin={handleLogin}
            goRegister={() => nav("/register")}
            goGuest={handleGuest}
          />
        }
      />
      <Route
        path="/register"
        element={<Register goLogin={() => nav("/login")} onRegistered={() => nav("/login")} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
