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

  function mapLoginError(error) {
    const msg = (error && error.message) || "";
    const code = error && (error.code || error?.body?.error?.code);
    const status = error && error.status;
    if (status === 401 && (code === "BAD_CREDENTIALS" || /invalid credentials/i.test(msg) || /unauthorized/i.test(msg))) {
      return "Incorrect email or password";
    }
    if (status === 429) return "Too many attempts. Please try again in a minute.";
    if (status === 400) return "Please enter a valid email and an 8+ character password.";
    if (status >= 500) return "Server error. Please try again shortly.";
    if (code === "RATE_LIMITED") return "Too many attempts. Please try again in a minute.";
    return msg || "Login failed";
  }

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      // Prefer legacy login first; optionally try Better Auth if enabled
      try {
        const { token, user } = await api("/auth/login", {
          method: "POST",
          body: { emailOrUsername: email.trim(), password },
        });
        onLogin(token, user);
        return;
      } catch (le) {
        // If credentials are wrong, show message and do not try alternate providers
        const status = le && le.status;
        const code = le && (le.code || le?.body?.error?.code);
        if (status === 401 && (code === "BAD_CREDENTIALS" || /invalid credentials/i.test(le.message || ""))) {
          setErr(mapLoginError(le));
          return;
        }
        // otherwise continue to Better Auth path if enabled
      }
      if (ENABLE_BETTER_AUTH) {
        const { token: baToken, user: baUser } = await api("/better-auth/sign-in/email", {
          method: "POST",
          body: { email: email.trim(), password },
        });
        onLogin(baToken || "session", { username: baUser?.name, email: baUser?.email });
        return;
      }
      throw new Error("Login failed");
    } catch (e) {
      setErr(mapLoginError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1 className="page-header">Login</h1>
      <form className="card auth-box" onSubmit={submit}>
        {err && <p style={{ color: "var(--danger)", marginTop: 10, textAlign: "center"  }}>{err}</p>}
        <input
          className="input"
          type="email"
          placeholder="Email"
          name="email"
          autoComplete="email"
          inputMode="email"
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
    </div>
  );
}
