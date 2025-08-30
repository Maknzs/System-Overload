import { useState } from "react";
import { api } from "../api";
import "./Login.css";

export default function Login({ onLogin, goRegister, goBack }) {
  const [emailOrUsername, setId] = useState("");
  const [password, setPw] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { token, user } = await api("/auth/login", {
        method: "POST",
        body: { emailOrUsername, password },
      });
      onLogin(token, user);
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
          placeholder="Email or Username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={emailOrUsername}
          onChange={(e) => setId(e.target.value)}
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
