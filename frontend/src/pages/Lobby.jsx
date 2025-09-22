import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Lobby.css";
import { api } from "../api";

// Allows up to 5 total participants. Each row can be Human or Bot.
export default function Lobby({ onStart, onBack, authed, user }) {
  const [players, setPlayers] = useState([
    { name: "Human #1", isBot: false },
    { name: "Human #2", isBot: false },
  ]);
  const nav = useNavigate();

  // Helper: default names for humans/bots
  const getHumanNameForIndex = (i) => `Human #${i + 1}`;
  const BOT_NAMES = ["Vizzini", "Inigo", "Fezzik", "Westley"];
  const getBotNameForIndex = (i, arr) => {
    const src = Array.isArray(arr) ? arr : players;
    // Choose the first unused default bot name across all players (exclude current index)
    const usedDefaultBotNames = new Set(
      src
        .map((p, idx) => (idx === i ? null : (p?.name || "").trim()))
        .filter((name) => !!name && BOT_NAMES.includes(name))
    );
    for (const name of BOT_NAMES) {
      if (!usedDefaultBotNames.has(name)) return name;
    }
    // Fallback: sequential generic numbering if all defaults are taken
    const otherBots = src
      .filter((_, idx) => idx !== i)
      .filter((p) => p.isBot).length;
    return `Bot ${otherBots + 1}`;
  };

  // If logged in, prefill first player name with username (overrides default Human #1)
  useEffect(() => {
    if (!user || !user.username) return;
    setPlayers((prev) => {
      const current = (prev[0]?.name || "").trim();
      if (current && current !== "Human #1") return prev; // don't overwrite if user already typed non-default
      const next = prev.slice();
      next[0] = { ...next[0], name: user.username };
      return next;
    });
  }, [user]);

  const addPlayer = (isBot = false) => {
    if (players.length >= 5) return;
    const i = players.length;
    const name = isBot
      ? getBotNameForIndex(i, players)
      : getHumanNameForIndex(i);
    setPlayers([...players, { name, isBot }]);
  };

  const removePlayer = (i) =>
    players.length > 2 && setPlayers(players.filter((_, idx) => idx !== i));

  const updateName = (i, name) => {
    const next = players.slice();
    next[i] = { ...next[i], name };
    setPlayers(next);
  };

  const toggleBot = (i) => {
    const next = players.slice();
    const toBot = !next[i].isBot;
    next[i] = { ...next[i], isBot: toBot };
    // Update name only if it's empty or a default-like value
    const humanDefault = getHumanNameForIndex(i);
    const botDefault = getBotNameForIndex(i, next);
    const current = (next[i].name || "").trim();
    const looksHumanDefault = current === "" || current === humanDefault;
    const looksBotDefault =
      current === botDefault ||
      BOT_NAMES.includes(current) ||
      /^Bot\s+\d+$/.test(current);
    if (toBot && looksHumanDefault) {
      next[i].name = botDefault;
    } else if (!toBot && (current === "" || looksBotDefault)) {
      next[i].name = humanDefault;
    }
    setPlayers(next);
  };

  const start = () => {
    // Assign defaults for any empty names before filtering
    // Bots are named in order: Vizzini, Inigo Montoya, Fezzik, Prince Humperdinck
    let botCounter = 0;
    const finalized = players.map((p, i) => {
      let name = (p.name || "").trim();
      if (!name) {
        if (p.isBot) {
          // Use next bot name from the list; fall back to generic if more than provided
          name = BOT_NAMES[botCounter] || `Bot ${botCounter + 1}`;
          botCounter += 1;
        } else {
          name = `Player ${i + 1}`;
        }
      }
      return { ...p, name };
    });

    const valid = finalized.filter((p) => Boolean(p.name));
    if (valid.length < 2) return; // need at least 2 participants

    // Map to shape expected by Game route
    onStart(
      valid.map((p, i) => ({ id: String(i + 1), name: p.name, isBot: p.isBot }))
    );
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
      <h1 className="page-header">Lobby</h1>

      <div className="card">
        <div className="lobby-grid">
          <div className="player-row player-header">
            <div>
              <div className="section-title">Player Names</div>
            </div>
            <div className="bot-col">Bot?</div>
            <div className="remove-col"></div>
          </div>
          {players.map((p, i) => {
            // Determine placeholder using the first unused default bot name
            const botPlaceholder = getBotNameForIndex(i, players);
            const placeholder = p.isBot ? botPlaceholder : `Human #${i + 1}`;
            return (
              <div className="player-row" key={i}>
                <input
                  className="input"
                  value={p.name}
                  placeholder={placeholder}
                  onChange={(e) => updateName(i, e.target.value)}
                />
                <div className="bot-col">
                  {i > 0 && (
                    <input
                      type="checkbox"
                      aria-label="Bot"
                      checked={p.isBot}
                      onChange={() => toggleBot(i)}
                    />
                  )}
                </div>
                <div className="remove-col">
                  {i >= 2 && (
                    <button
                      className="btn btn-danger btn-x"
                      aria-label="Remove player"
                      title="Remove player"
                      onClick={() => removePlayer(i)}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="lobby-actions">
          <button
            className="btn btn-accent"
            onClick={start}
            disabled={!(players[0]?.name || "").trim()}
          >
            Start Game
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => addPlayer(false)}
            disabled={players.length >= 5}
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
