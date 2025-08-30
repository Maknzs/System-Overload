import { useState } from "react";
import { api } from "../api";
import "./Register.css";

export default function Register({ goLogin, onRegistered }) {
  const [email, setEmail] = useState("");
  const [username, setUser] = useState("");
  const [password, setPw] = useState("");
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await api("/auth/register", {
        method: "POST",
        body: { email, username, password },
      });
      setOk(true);
      onRegistered?.(); // App navigates to /login
    } catch (e) {
      setErr(e.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1 className="page-header">Register</h1>
      <form className="card auth-box" onSubmit={submit}>
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          placeholder="Username"
          value={username}
          onChange={(e) => setUser(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPw(e.target.value)}
        />
        <div className="auth-actions">
          <button className="btn btn-accent" type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={goLogin}>
            Back to login
          </button>
        </div>
      </form>
      {ok && (
        <p style={{ color: "var(--success)", marginTop: 10 }}>
          Account created!
        </p>
      )}
      {err && <p style={{ color: "var(--danger)", marginTop: 10 }}>{err}</p>}
    </div>
  );
}
