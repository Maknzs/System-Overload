import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Lobby.css";
import { api } from "../api";

export default function Lobby({ onStart, onBack, authed, user }) {
  const [names, setNames] = useState(["", ""]);
  const nav = useNavigate();

  // If logged in, prefill first player name with username once (editable)
  useEffect(() => {
    if (!user || !user.username) return;
    setNames((prev) => {
      if (prev[0]) return prev; // don't overwrite if user already typed
      const next = prev.slice();
      next[0] = user.username;
      return next;
    });
  }, [user]);

  const addPlayer = () => names.length < 5 && setNames([...names, ""]);
  const removePlayer = (i) =>
    names.length > 2 && setNames(names.filter((_, idx) => idx !== i));
  const update = (i, v) => {
    const next = names.slice();
    next[i] = v;
    setNames(next);
  };

  const start = () => {
    const players = names
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n, i) => ({ id: String(i + 1), name: n }));
    if (players.length >= 2) onStart(players);
  };

  // Feedback state
  const [fbEmail, setFbEmail] = useState("");
  const [fbMsg, setFbMsg] = useState("");
  const [fbStatus, setFbStatus] = useState("idle"); // idle | sending | success | error
  const [fbError, setFbError] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  // If logged in, prefill feedback email once (do not overwrite manual input)
  useEffect(() => {
    if (user && user.email) {
      setFbEmail((prev) => (prev ? prev : user.email));
    }
  }, [user]);

  const submitFeedback = async (e) => {
    e.preventDefault();
    if (fbStatus === "sending") return;
    setFbError("");
    const players = names.map((n) => n.trim()).filter(Boolean);
    if (!fbMsg || fbMsg.trim().length < 5) {
      setFbError("Please enter at least 5 characters.");
      return;
    }
    setFbStatus("sending");
    try {
      await api.submitFeedback({
        email: fbEmail || undefined,
        message: fbMsg.trim(),
        players,
      });
      setFbStatus("success");
      setFbMsg("");
    } catch (err) {
      setFbStatus("error");
      setFbError(err?.message || "Failed to send. Please try again.");
    }
  };

  return (
    <div className="page">
      <h1 className="page-header">System-Overload</h1>

      <div className="card">
        <div className="section-title">Enter Player Names</div>
        <div className="lobby-grid">
          {names.map((n, i) => (
            <div className="player-row" key={i}>
              <input
                className="input"
                value={n}
                placeholder={`Player ${i + 1} name`}
                onChange={(e) => update(i, e.target.value)}
              />
              {i >= 2 && (
                <button
                  className="btn btn-ghost"
                  onClick={() => removePlayer(i)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="lobby-actions">
          <button
            className="btn btn-accent"
            onClick={start}
            disabled={names.filter((x) => x.trim()).length < 2}
          >
            Start Game
          </button>
          <button
            className="btn btn-ghost"
            onClick={addPlayer}
            disabled={names.length >= 5}
          >
            Add Player
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => (authed ? onBack() : nav("/login"))}
          >
            {authed ? "View Profile" : "Login / Register"}
          </button>
        </div>
      </div>

      {/* Feedback section (toggle like profile settings)
      <div className="card" style={{ marginTop: 14 }}>
        <div className="hstack" style={{ justifyContent: "space-between" }}>
          <div className="section-title" style={{ fontSize: 18 }}>
            Comments / Suggestions
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setShowFeedback((v) => {
                const nv = !v;
                if (!nv) {
                  setFbEmail("");
                  setFbMsg("");
                  setFbError("");
                  setFbStatus("idle");
                }
                return nv;
              });
            }}
          >
            {showFeedback ? "Cancel" : "Leave Feedback"}
          </button>
        </div>
        {showFeedback && (
          <form onSubmit={submitFeedback} className="feedback-form">
            <div className="player-row">
              <input
                className="input"
                type="email"
                value={fbEmail}
                placeholder="Your email (optional)"
                onChange={(e) => setFbEmail(e.target.value)}
              />
            </div>
            <div className="player-row">
              <textarea
                className="input"
                value={fbMsg}
                placeholder="Share a comment or suggestion..."
                rows={3}
                onChange={(e) => setFbMsg(e.target.value)}
              />
            </div>
            {fbError && (
              <div className="card-disc" style={{ color: "var(--warning)" }}>
                {fbError}
              </div>
            )}
            {fbStatus === "success" && (
              <div className="card-disc" style={{ color: "var(--success)" }}>
                Thanks! Your feedback was sent.
              </div>
            )}
            <div className="lobby-actions" style={{ marginTop: 6 }}>
              <button
                className="btn btn-ghost"
                type="submit"
                disabled={fbStatus === "sending"}
              >
                {fbStatus === "sending" ? "Sending..." : "Send Feedback"}
              </button>
            </div>
          </form>
        )}
      </div> */}
    </div>
  );
}
