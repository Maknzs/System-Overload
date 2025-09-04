import { useState } from "react";
import { api } from "../api";
import "./Login.css";

export default function Login({ onLogin, goRegister, goBack }) {
  const [email, setEmail] = useState("");
  const [password, setPw] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const ENABLE_BETTER_AUTH = (() => {
    try {
      const v = import.meta?.env?.VITE_ENABLE_BETTER_AUTH;
      return v === "1" || String(v).toLowerCase() === "true";
    } catch (_) {
      return false;
    }
  })();

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      // Prefer legacy login first; optionally try Better Auth if enabled
      try {
        const { token, user } = await api("/auth/login", {
          method: "POST",
          body: { emailOrUsername: email, password },
        });
        onLogin(token, user);
        return;
      } catch (_) {
        // legacy failed; optionally try Better Auth
      }
      if (ENABLE_BETTER_AUTH) {
        const { token: baToken, user: baUser } = await api("/better-auth/sign-in/email", {
          method: "POST",
          body: { email, password },
        });
        onLogin(baToken || "session", { username: baUser?.name, email: baUser?.email });
        return;
      }
      throw new Error("Login failed");
    } catch (e) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1 className="page-header">Login</h1>
      <form className="card auth-box" onSubmit={submit}>
        <input
          className="input"
          type="email"
          placeholder="Email"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          name="current-password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPw(e.target.value)}
        />
        <div className="auth-actions">
          <button className="btn btn-accent" type="submit" disabled={loading}>
            {loading ? "Logging in…" : "Login"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={goRegister}>
            Register
          </button>
          <button className="btn btn-ghost" type="button" onClick={goBack}>
            Back to Lobby
          </button>
        </div>
      </form>
      {err && <p style={{ color: "var(--danger)", marginTop: 10 }}>{err}</p>}
    </div>
  );
}
