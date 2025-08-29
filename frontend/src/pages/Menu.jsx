import { useState, useRef } from "react";
import { api } from "../api";
import "./Menu.css";

export default function Menu({ user, onStart, onLogout, onUserUpdate }) {
  const [loading, setLoading] = useState({ email: false, username: false, password: false });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Visibility toggles
  const [showEmail, setShowEmail] = useState(false);
  const [showUsername, setShowUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Email form state
  const [newEmail, setNewEmail] = useState("");
  const [emailPw, setEmailPw] = useState("");

  // Username form state
  const [newUsername, setNewUsername] = useState("");
  const [userPw, setUserPw] = useState("");

  // Password form state
  const [currPw, setCurrPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const anyOpen = showEmail || showUsername || showPassword;

  async function refreshUser() {
    try {
      const me = await api("/auth/me");
      onUserUpdate?.(me);
    } catch {}
  }

  const statusTimerRef = useRef(null);
  function setStatus(message, error = false, ms = 4000) {
    // Clear any existing hide timer so the message persists for the full duration
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    setErr(error ? message : "");
    setMsg(!error ? message : "");
    statusTimerRef.current = setTimeout(() => {
      setErr("");
      setMsg("");
      statusTimerRef.current = null;
    }, ms);
  }

  async function submitEmail(e) {
    e.preventDefault();
    setLoading((s) => ({ ...s, email: true }));
    try {
      await api.updateEmail({ newEmail, currentPassword: emailPw });
      setNewEmail("");
      setEmailPw("");
      // Show success immediately; refresh user info in background
      setStatus("Changes saved");
      try { await refreshUser(); } catch {}
    } catch (e) {
      setStatus(e.message || "Failed to update email", true);
    } finally {
      setLoading((s) => ({ ...s, email: false }));
    }
  }

  async function submitUsername(e) {
    e.preventDefault();
    setLoading((s) => ({ ...s, username: true }));
    try {
      await api.updateUsername({ newUsername, currentPassword: userPw });
      setNewUsername("");
      setUserPw("");
      // Show success immediately; refresh user info in background
      setStatus("Changes saved");
      try { await refreshUser(); } catch {}
    } catch (e) {
      setStatus(e.message || "Failed to update username", true);
    } finally {
      setLoading((s) => ({ ...s, username: false }));
    }
  }

  async function submitPassword(e) {
    e.preventDefault();
    if (newPw !== newPw2) {
      setStatus("Passwords do not match", true);
      return;
    }
    setLoading((s) => ({ ...s, password: true }));
    try {
      await api.updatePassword({ currentPassword: currPw, newPassword: newPw });
      setCurrPw("");
      setNewPw("");
      setNewPw2("");
      setStatus("Changes saved");
    } catch (e) {
      setStatus(e.message || "Failed to update password", true);
    } finally {
      setLoading((s) => ({ ...s, password: false }));
    }
  }
  return (
    <div className="page menu-page">
      <div className="menu-header">
        <h1 className="page-header">System Overload</h1>
        <span className="badge">Local</span>
      </div>

      {!anyOpen && (
        <div className="card user-card" style={{ marginBottom: 16 }}>
          <div>Username: {user?.username}</div>
          <div>Email: {user?.email}</div>
          <div>Games played: {user?.gamesPlayed ?? 0}</div>
        </div>
      )}

      <div className="actions" style={{ marginBottom: 16 }}>
        <button className="btn btn-accent" onClick={onStart}>
          Start New Local Game
        </button>
        <button className="btn btn-ghost" onClick={onLogout}>
          Logout
        </button>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-title">Account Settings</div>
        {msg && <div className="pill" style={{ color: "#16a34a" }}>{msg}</div>}
        {err && <div className="pill" style={{ color: "#ef4444" }}>{err}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {/* Email section */}
          <div className="card" style={{ padding: 12 }}>
            <div className="hstack" style={{ justifyContent: "space-between" }}>
              <div className="section-title" style={{ fontSize: 18 }}>Email</div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowEmail((v) => {
                    const nv = !v;
                    if (!nv) { setNewEmail(""); setEmailPw(""); }
                    return nv;
                  });
                }}
              >
                {showEmail ? "Cancel" : "Change Email"}
              </button>
            </div>
            {showEmail && (
              <form onSubmit={submitEmail}>
                {/* Hidden username for password manager context */}
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={user?.username || user?.email || ""}
                  readOnly
                  aria-hidden="true"
                  style={{ position: "absolute", left: -9999, width: 0, height: 0, opacity: 0 }}
                />
                <div className="hstack" style={{ gap: 8, marginTop: 8 }}>
                  <input
                    className="input"
                    type="email"
                    placeholder="New email"
                    value={newEmail}
                    name="email"
                    autoComplete="email"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  <input
                    className="input"
                    type="password"
                    placeholder="Current account password"
                    value={emailPw}
                    name="current-password"
                    autoComplete="current-password"
                    onChange={(e) => setEmailPw(e.target.value)}
                  />
                  <button className="btn" disabled={loading.email}>
                    {loading.email ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Username section */}
          <div className="card" style={{ padding: 12 }}>
            <div className="hstack" style={{ justifyContent: "space-between" }}>
              <div className="section-title" style={{ fontSize: 18 }}>Username</div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowUsername((v) => {
                    const nv = !v;
                    if (!nv) { setNewUsername(""); setUserPw(""); }
                    return nv;
                  });
                }}
              >
                {showUsername ? "Cancel" : "Change Username"}
              </button>
            </div>
            {showUsername && (
              <form onSubmit={submitUsername}>
                {/* Hidden username for password manager context */}
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={user?.username || user?.email || ""}
                  readOnly
                  aria-hidden="true"
                  style={{ position: "absolute", left: -9999, width: 0, height: 0, opacity: 0 }}
                />
                <div className="hstack" style={{ gap: 8, marginTop: 8 }}>
                  <input
                    className="input"
                    type="text"
                    placeholder="New username"
                    value={newUsername}
                    name="username"
                    autoComplete="username"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                  <input
                    className="input"
                    type="password"
                    placeholder="Current account password"
                    value={userPw}
                    name="current-password"
                    autoComplete="current-password"
                    onChange={(e) => setUserPw(e.target.value)}
                  />
                  <button className="btn" disabled={loading.username}>
                    {loading.username ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Password section */}
          <div className="card" style={{ padding: 12 }}>
            <div className="hstack" style={{ justifyContent: "space-between" }}>
              <div className="section-title" style={{ fontSize: 18 }}>Password</div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowPassword((v) => {
                    const nv = !v;
                    if (!nv) { setCurrPw(""); setNewPw(""); setNewPw2(""); }
                    return nv;
                  });
                }}
              >
                {showPassword ? "Cancel" : "Change Password"}
              </button>
            </div>
            {showPassword && (
              <form onSubmit={submitPassword}>
                {/* Hidden username for password manager context */}
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={user?.username || user?.email || ""}
                  readOnly
                  aria-hidden="true"
                  style={{ position: "absolute", left: -9999, width: 0, height: 0, opacity: 0 }}
                />
                <div className="hstack" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <input
                    className="input"
                    type="password"
                    placeholder="Current password"
                    value={currPw}
                    name="current-password"
                    autoComplete="current-password"
                    onChange={(e) => setCurrPw(e.target.value)}
                  />
                  <input
                    className="input"
                    type="password"
                    placeholder="New password"
                    value={newPw}
                    name="new-password"
                    autoComplete="new-password"
                    onChange={(e) => setNewPw(e.target.value)}
                  />
                  <input
                    className="input"
                    type="password"
                    placeholder="Confirm new password"
                    value={newPw2}
                    name="new-password-confirm"
                    autoComplete="new-password"
                    onChange={(e) => setNewPw2(e.target.value)}
                  />
                  <button className="btn" disabled={loading.password}>
                    {loading.password ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// return (
//   <div style={{ padding: 16 }}>
//     <h2>Welcome{user?.username ? `, ${user.username}` : ""}</h2>
//     {user?.email && <p>Email: {user.email}</p>}
//     <p>Games Played: {user?.gamesPlayed ?? 0}</p>

//     <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
//       <button type="button" onClick={() => nav("/lobby")}>
//         Start New Game
//       </button>

//       {/* If you have auth wired up, call your logout API first, then nav("/") or "/login" */}
//       <button
//         type="button"
//         onClick={() => nav("/login")}
//         style={{ marginLeft: 8 }}
//       >
//         Logout
//       </button>
//     </div>
//   </div>
// );
